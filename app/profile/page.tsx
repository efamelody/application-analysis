import { ProfileClient } from "./profile-client";
import { getCandidateProfile } from "@/lib/profile";
import { connection } from "next/server";
import { hasAppSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export const instant = false;

export default async function ProfilePage() {
  await connection();
  if (!(await hasAppSession())) redirect("/login");
  let initial;
  let notice: string | undefined;
  try {
    initial = await getCandidateProfile();
  } catch (error) {
    notice = error instanceof Error ? error.message : "Neon is not configured";
    initial = {
      profile: {
        id: 1,
        full_name: "",
        headline: "",
        master_cv: "",
        preferred_roles: "TypeScript Full-Stack Developer",
        preferred_locations: "Kuala Lumpur, Selangor",
        remote_preference: "",
        updated_at: new Date().toISOString(),
      },
      evidence: [],
    };
  }
  return <ProfileClient initial={initial} notice={notice} />;
}
