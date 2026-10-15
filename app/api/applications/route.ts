import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

// GET /api/applications — list for the dashboard (server component fetches this
// client-side; keep server-side so the service-role key never leaves the server).
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("applications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return NextResponse.json({ success: true, applications: data });
  } catch (err: unknown) {
    // Graceful when Supabase isn't configured yet (fresh clone)
    const message = err instanceof Error ? err.message : "Unknown error";
    const notConfigured =
      message.includes("Missing NEXT_PUBLIC_SUPABASE_URL") ||
      message.includes("Missing SUPABASE");
    return NextResponse.json(
      {
        success: notConfigured,
        applications: [],
        ...(notConfigured
          ? { notice: "Supabase not configured — run the migration and set .env.local" }
          : { error: message }),
      },
      { status: notConfigured ? 200 : 500 }
    );
  }
}
