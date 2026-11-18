import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCandidateProfile } from "@/lib/profile";
import { profileSchema } from "@/lib/validation";
import { isAppRequestAuthorized } from "@/lib/auth";

export async function GET(request: Request) {
  if (!isAppRequestAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ success: true, ...(await getCandidateProfile()) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load profile" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  if (!isAppRequestAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid profile", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const sql = getDb();
    const { full_name, headline, master_cv, preferred_roles, preferred_locations, remote_preference } = parsed.data;
    await sql`
      INSERT INTO candidate_profile
        (id, full_name, headline, master_cv, preferred_roles, preferred_locations, remote_preference)
      VALUES (1, ${full_name}, ${headline}, ${master_cv}, ${preferred_roles}, ${preferred_locations}, ${remote_preference})
      ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        headline = EXCLUDED.headline,
        master_cv = EXCLUDED.master_cv,
        preferred_roles = EXCLUDED.preferred_roles,
        preferred_locations = EXCLUDED.preferred_locations,
        remote_preference = EXCLUDED.remote_preference
    `;
    return NextResponse.json({ success: true, ...(await getCandidateProfile()) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save profile" },
      { status: 500 }
    );
  }
}
