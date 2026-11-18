import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generateJson } from "@/lib/gemini";
import { emailWebhookSchema } from "@/lib/validation";

const VALID_STATUSES = new Set([
  "viewed",
  "unlikely_to_progress",
  "interviewing",
  "rejected",
  "closed",
]);

function extractEmailText(payload: Record<string, unknown>): {
  text: string;
  subject: string;
} {
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const text =
    str(payload.text) ||
    str(payload["body-plain"]) ||
    str(payload["stripped-text"]) ||
    str(payload.stripped) ||
    str(payload.html) ||
    str(payload["body-html"]) ||
    "";
  const subject = str(payload.subject) || str(payload.Subject) || "";
  return { text, subject };
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: Request) {
  try {
    // Authenticate inbound provider
    const secret = process.env.EMAIL_WEBHOOK_SECRET;
    const provided =
      req.headers.get("x-webhook-secret") ||
      req.headers.get("x-mailgun-webhook-secret") ||
      new URL(req.url).searchParams.get("secret");
    if (!secret || provided !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = emailWebhookSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { text: rawText, subject } = extractEmailText(
      parsed.data as Record<string, unknown>
    );
    let text = rawText;
    if (text.includes("<") && text.includes(">")) text = stripHtml(text);
    const emailText = `${subject ? `Subject: ${subject}\n` : ""}${text}`.trim();

    if (!emailText) {
      return NextResponse.json({ message: "No content" }, { status: 200 });
    }

    const prompt = `
Analyze this JobStreet email (subject + body):
${emailText.slice(0, 4000)}

Extract the hiring company name and the candidate's application status. Map to one of:
"viewed" (employer viewed application), "unlikely_to_progress" (not shortlisted / unsuccessful / unlikely to progress),
"closed" (job closed/expired), "interviewing" (interview invitation / shortlisted for interview), "rejected" (explicit rejection), or "unknown".

Return ONLY JSON:
{ "company_name": "company name or empty string", "status": "viewed" | "unlikely_to_progress" | "closed" | "interviewing" | "rejected" | "unknown" }`;

    const { company_name, status } = await generateJson<{
      company_name: string;
      status: string;
    }>(prompt);

    if (company_name && VALID_STATUSES.has(status)) {
      const sql = getDb();
      // Update the most recent open application for this company
      const [match] = (await sql`
        SELECT id FROM applications
        WHERE company_name ILIKE ${`%${company_name.trim()}%`}
          AND status IN ('applied', 'viewed', 'interviewing')
        ORDER BY created_at DESC LIMIT 1
      `) as unknown as Array<{ id: string }>;

      if (match) {
        await sql`
          UPDATE applications
          SET status = ${status}::app_status,
              last_email_snippet = ${emailText.slice(0, 300)}
          WHERE id = ${match.id}
        `;
      }
    }

    return NextResponse.json({
      success: true,
      parsed: { company_name, status },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
