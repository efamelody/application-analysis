import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isAppRequestAuthorized } from "@/lib/auth";
import { updateApplicationStatusSchema } from "@/lib/validation";

// GET /api/applications — list for the dashboard (server component fetches this
// client-side; keep server-side so the service-role key never leaves the server).
export async function GET(request: Request) {
  if (!isAppRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const sql = getDb();
    const applications = await sql`
      SELECT * FROM applications ORDER BY created_at DESC LIMIT 200
    `;
    return NextResponse.json({ success: true, applications });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const notConfigured = message.includes("Missing DATABASE_URL");
    return NextResponse.json(
      {
        success: notConfigured,
        applications: [],
        ...(notConfigured
          ? { notice: "Neon not configured — run the migrations and set DATABASE_URL" }
          : { error: message }),
      },
      { status: notConfigured ? 200 : 500 }
    );
  }
}

export async function PATCH(request: Request) {
  if (!isAppRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = updateApplicationStatusSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const sql = getDb();
    const { id, status } = parsed.data;
    const [application] = (await sql`
      UPDATE applications
      SET status = ${status}::app_status
      WHERE id = ${id}
      RETURNING *
    `) as unknown as Record<string, unknown>[];

    if (!application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, application });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
