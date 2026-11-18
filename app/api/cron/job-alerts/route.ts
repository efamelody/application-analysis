import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getJobAlertEmails, processJobAlerts } from "@/lib/gmail";
import { generateJson } from "@/lib/gemini";
import { getCandidateProfile, profilePromptText } from "@/lib/profile";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sql = getDb();
    const { profile, evidence } = await getCandidateProfile();
    const emails = await getJobAlertEmails();

    const summary = await processJobAlerts({
      emails,
      profilePrompt: profilePromptText(profile, evidence),
      checkAlreadyProcessed: async (messageId) => {
        const [alreadyProcessed] = (await sql`
          SELECT id FROM applications WHERE source_message_id = ${messageId} LIMIT 1
        `) as unknown as Array<{ id: string }>;
        return Boolean(alreadyProcessed);
      },
      extractJob: async (_email, prompt) => generateJson<unknown>(prompt),
      insertJob: async (email, result) => {
        const [inserted] = (await sql`
          INSERT INTO applications (
            company_name, job_title, job_url, job_description, salary_range,
            status, match_score, strengths, gaps_and_risks,
            improvement_action_item, cover_letter_type, cover_letter_content,
            source, source_message_id, location, is_remote, training_signals,
            cv_suggestions, discovered_at
          ) VALUES (
            ${result.company_name}, ${result.job_title}, ${result.job_url || null},
            ${email.text}, ${result.salary_range || null}, 'discovered',
            ${result.match_score}, ${result.strengths || null}, ${result.gaps_and_risks || null},
            ${result.improvement_action_item || null}, 'generic', NULL,
            ${email.from.includes("linkedin") ? "linkedin" : "jobstreet"},
            ${email.id}, ${result.location || null}, ${result.is_remote},
            ${result.training_signals || null}, ${result.cv_suggestions || null},
            NOW()
          ) ON CONFLICT DO NOTHING RETURNING id
        `) as unknown as Array<{ id: string }>;
        return Boolean(inserted);
      },
      onErrorLog: (entry) => {
        console.error(JSON.stringify(entry));
      },
    });

    console.info(
      JSON.stringify({
        event: "job_alerts_cron_summary",
        messagesFound: summary.messagesFound,
        jobsCreated: summary.jobsCreated,
        duplicatesSkipped: summary.duplicatesSkipped,
        nonJobSkipped: summary.nonJobSkipped,
        aiExtractionFailures: summary.aiExtractionFailures,
        databaseFailures: summary.databaseFailures,
      })
    );

    return NextResponse.json(summary);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "job_alerts_cron_fatal",
        errorType: error instanceof Error ? error.name : "UnknownError",
      })
    );
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Job alert processing failed" },
      { status: 500 }
    );
  }
}
