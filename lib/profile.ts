import { getDb } from "./db";

export interface CandidateProfile {
  id: number;
  full_name: string;
  headline: string;
  master_cv: string;
  preferred_roles: string;
  preferred_locations: string;
  remote_preference: string;
  updated_at: string;
}

export interface ProfileEvidence {
  id: string;
  title: string;
  technologies: string;
  summary: string;
  outcome: string;
  created_at: string;
  updated_at: string;
}

export async function getCandidateProfile() {
  const sql = getDb();
  const profileRows = (await sql`
    SELECT id, full_name, headline, master_cv, preferred_roles,
      preferred_locations, remote_preference, updated_at
    FROM candidate_profile WHERE id = 1
  `) as unknown as CandidateProfile[];
  const [profile] = profileRows;
  const evidence = (await sql`
    SELECT id, title, technologies, summary, outcome, created_at, updated_at
    FROM profile_evidence ORDER BY created_at DESC
  `) as unknown as ProfileEvidence[];
  return {
    profile: profile ?? {
      id: 1,
      full_name: "",
      headline: "",
      master_cv: "",
      preferred_roles: "TypeScript Full-Stack Developer",
      preferred_locations: "Kuala Lumpur, Selangor",
      remote_preference: "",
      updated_at: new Date().toISOString(),
    },
    evidence,
  };
}

export function profilePromptText(
  profile: CandidateProfile,
  evidence: ProfileEvidence[]
): string {
  const evidenceText = evidence.slice(0, 20)
    .map(
      (item) =>
        `Project: ${item.title}\nTechnologies: ${item.technologies}\nSummary: ${item.summary}\nOutcome: ${item.outcome}`
    )
    .join("\n\n")
    .slice(0, 12000);
  return `Name: ${profile.full_name}\nHeadline: ${profile.headline}\nPreferred roles: ${profile.preferred_roles}\nPreferred locations: ${profile.preferred_locations}\nRemote preference: ${profile.remote_preference}\n\nMaster CV:\n${profile.master_cv}\n\nEvidence:\n${evidenceText}`;
}
