export type AppStatus =
  | "applied"
  | "viewed"
  | "interviewing"
  | "unlikely_to_progress"
  | "rejected"
  | "closed";

export interface Application {
  id: string;
  created_at: string;
  updated_at: string;
  company_name: string;
  job_title: string;
  job_url: string | null;
  job_description: string | null;
  salary_range: string | null;
  status: AppStatus;
  match_score: number | null;
  strengths: string | null;
  gaps_and_risks: string | null;
  improvement_action_item: string | null;
  cover_letter_type: "generic" | "custom";
  cover_letter_content: string | null;
  last_email_snippet: string | null;
}

export interface GapAnalysis {
  match_score: number;
  strengths: string;
  gaps_and_risks: string;
  improvement_action_item: string;
}
