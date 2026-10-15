import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { generateJson } from "@/lib/gemini";
import { GENERIC_COVER_LETTER, CANDIDATE_PROFILE } from "@/lib/coverLetter";
import { createApplicationSchema } from "@/lib/validation";
import type { GapAnalysis } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = createApplicationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { company_name, job_title, job_url, job_description, salary_range } =
      parsed.data;

    const supabase = getSupabaseAdmin();

    // Dedupe: same URL already tracked
    if (job_url) {
      const { data: existing } = await supabase
        .from("applications")
        .select("id")
        .eq("job_url", job_url)
        .limit(1)
        .maybeSingle();
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
Candidate Profile: ${CANDIDATE_PROFILE}

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

    const { data, error } = await supabase
      .from("applications")
      .insert({
        company_name,
        job_title,
        job_url: job_url || null,
        job_description: job_description || null,
        salary_range: salary_range || null,
        status: "applied",
        match_score: gap?.match_score ?? null,
        strengths: gap?.strengths ?? null,
        gaps_and_risks: gap?.gaps_and_risks ?? null,
        improvement_action_item: gap?.improvement_action_item ?? null,
        cover_letter_type: "generic",
        cover_letter_content: GENERIC_COVER_LETTER,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, application: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
