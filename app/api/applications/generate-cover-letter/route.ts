import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generateText } from "@/lib/gemini";
import { generateCoverLetterSchema } from "@/lib/validation";
import { getCandidateProfile, profilePromptText } from "@/lib/profile";
import { isAppRequestAuthorized } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    if (!isAppRequestAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    const parsed = generateCoverLetterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const sql = getDb();
    const [app] = (await sql`SELECT * FROM applications WHERE id = ${parsed.data.id}`) as unknown as Array<{
      job_title: string;
      company_name: string;
      job_description: string | null;
    }>;

    if (!app) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    const { profile, evidence } = await getCandidateProfile();
    const prompt = `
Write a concise, tailored 3-paragraph cover letter for:
Candidate profile: ${profilePromptText(profile, evidence)}
Role: ${app.job_title} at ${app.company_name}
Job Description: ${(app.job_description || "").slice(0, 6000)}

Focus on relevant technical project overlaps. Keep tone professional, confident, and direct. Avoid generic filler phrasing.`;

    const customLetter = (await generateText(prompt)).trim();

    const [updatedApp] = (await sql`
      UPDATE applications
      SET cover_letter_type = 'custom', cover_letter_content = ${customLetter}
      WHERE id = ${parsed.data.id}
      RETURNING *
    `) as unknown as Record<string, unknown>[];
    return NextResponse.json({ success: true, application: updatedApp });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
