import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { generateText } from "@/lib/gemini";
import { generateCoverLetterSchema } from "@/lib/validation";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = generateCoverLetterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: app, error } = await supabase
      .from("applications")
      .select("*")
      .eq("id", parsed.data.id)
      .single();

    if (error || !app) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    const prompt = `
Write a concise, tailored 3-paragraph cover letter for:
Candidate: Nur Izfarwiza (BSc Computer Science, Full-Stack Dev: Next.js, TypeScript, Tailwind, Supabase, n8n)
Role: ${app.job_title} at ${app.company_name}
Job Description: ${(app.job_description || "").slice(0, 6000)}

Focus on relevant technical project overlaps. Keep tone professional, confident, and direct. Avoid generic filler phrasing.`;

    const customLetter = (await generateText(prompt)).trim();

    const { data: updatedApp, error: updateError } = await supabase
      .from("applications")
      .update({
        cover_letter_type: "custom",
        cover_letter_content: customLetter,
      })
      .eq("id", parsed.data.id)
      .select()
      .single();

    if (updateError) throw updateError;
    return NextResponse.json({ success: true, application: updatedApp });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
