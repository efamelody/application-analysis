import { DashboardClient } from "./components/dashboard-client";
import type { Application } from "@/lib/types";

async function getApplications(): Promise<{
  applications: Application[];
  notice?: string;
}> {
  // Server-side fetch from our own API would need absolute URL; instead read
  // directly only if configured. Fall back to empty so `npm run build` works
  // without env vars (dashboard hydrates empty state, API fills in at runtime
  // once deployed with env). For simplicity the client state starts here;
  // live data flows through /api/applications at runtime via revalidation.
  // We attempt a direct Supabase read when env is present.
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return {
        applications: [],
        notice: "Supabase not configured — run supabase/migrations/001_applications.sql and set .env.local",
      };
    }
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supabase
      .from("applications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return { applications: (data ?? []) as Application[] };
  } catch (e) {
    return {
      applications: [],
      notice: e instanceof Error ? e.message : "Failed to load applications",
    };
  }
}

export default async function Home() {
  const { applications, notice } = await getApplications();
  return <DashboardClient initial={applications} notice={notice} />;
}
