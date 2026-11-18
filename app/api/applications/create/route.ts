import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generateJson } from "@/lib/gemini";
import { buildGenericCoverLetter } from "@/lib/coverLetter";
import { getCandidateProfile, profilePromptText } from "@/lib/profile";
import { createApplicationSchema } from "@/lib/validation";
import { safeListingUrl } from "@/lib/gmail";
import type { GapAnalysis } from "@/lib/types";
import { isAppRequestAuthorized } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    if (!isAppRequestAuthorized(req, true)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    const parsed = createApplicationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { company_name, job_title, job_url: rawJobUrl, job_description, salary_range } =
      parsed.data;
    const job_url = rawJobUrl ? safeListingUrl(rawJobUrl) : "";
    if (rawJobUrl && !job_url) {
      return NextResponse.json(
        { error: "Invalid input", details: { fieldErrors: { job_url: ["Must be a valid http or https job listing URL"] } } },
        { status: 400 }
      );
    }

    const sql = getDb();
    const { profile, evidence } = await getCandidateProfile();

    // Dedupe: same URL already tracked
    if (job_url) {
      const [existing] = (await sql`
        SELECT id FROM applications WHERE job_url = ${job_url} LIMIT 1
      `) as unknown as { id: string }[];
      if (existing) {
        return NextResponse.json(
          { success: false, error: "Already tracked", id: existing.id },
          { status: 409 }
        );
      }
    }

    // Run Gap Analysis via Gemini — save anyway if AI fails
    let gap: GapAnalysis | null = null;
    try {
      const prompt = `
You are an expert technical hiring advisor. Analyze this job description against the candidate profile below.
Candidate Profile: ${profilePromptText(profile, evidence)}

Job Title: ${job_title}
Company: ${company_name}
Job Description: ${(job_description || "").slice(0, 6000)}

Return ONLY a clean JSON object with this exact structure:
{
  "match_score": number (0 to 100),
  "strengths": "2-sentence summary of strong matches",
  "gaps_and_risks": "2-sentence summary of missing skills, experience gaps, or high-risk requirements that could cause this application to be filtered out or marked unlikely to progress",
  "improvement_action_item": "1 concrete advice or framing strategy on how to address these gaps on CV or in future applications"
}`;
      gap = await generateJson<GapAnalysis>(prompt);
      if (
        typeof gap.match_score !== "number" ||
        gap.match_score < 0 ||
        gap.match_score > 100
      ) {
        gap.match_score = Math.max(0, Math.min(100, Number(gap.match_score) || 0));
      }
    } catch (aiErr) {
      console.error("Gap analysis failed, saving without scores:", aiErr);
    }

    const [application] = (await sql`
      INSERT INTO applications (
        company_name, job_title, job_url, job_description, salary_range,
        status, match_score, strengths, gaps_and_risks,
        improvement_action_item, cover_letter_type, cover_letter_content
      ) VALUES (
        ${company_name}, ${job_title}, ${job_url || null},
        ${job_description || null}, ${salary_range || null}, 'discovered',
        ${gap?.match_score ?? null}, ${gap?.strengths ?? null},
        ${gap?.gaps_and_risks ?? null}, ${gap?.improvement_action_item ?? null},
        'generic', ${buildGenericCoverLetter(profile.full_name)}
      ) RETURNING *
    `) as unknown as Record<string, unknown>[];
    return NextResponse.json({ success: true, application });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
