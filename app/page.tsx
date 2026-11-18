import { DashboardClient } from "./components/dashboard-client";
import type { Application } from "@/lib/types";
import { getDb } from "@/lib/db";
import { connection } from "next/server";
import { hasAppSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export const instant = false;

async function getApplications(): Promise<{
  applications: Application[];
  notice?: string;
}> {
  try {
    if (!process.env.DATABASE_URL) {
      return {
        applications: [],
        notice: "Neon not configured — run the migrations and set DATABASE_URL",
      };
    }
    const applications = await getDb()`
      SELECT * FROM applications ORDER BY created_at DESC LIMIT 200
    `;
    return { applications: applications as Application[] };
  } catch (e) {
    return {
      applications: [],
      notice: e instanceof Error ? e.message : "Failed to load applications",
    };
  }
}

export default async function Home() {
  await connection();
  if (!(await hasAppSession())) redirect("/login");
  const { applications, notice } = await getApplications();
  return <DashboardClient initial={applications} notice={notice} />;
}
