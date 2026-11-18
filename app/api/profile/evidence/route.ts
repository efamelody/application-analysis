import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { evidenceSchema } from "@/lib/validation";
import { isAppRequestAuthorized } from "@/lib/auth";

export async function POST(request: Request) {
  if (!isAppRequestAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = evidenceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid evidence", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const sql = getDb();
    const { title, technologies, summary, outcome } = parsed.data;
    const [evidence] = (await sql`
      INSERT INTO profile_evidence (title, technologies, summary, outcome)
      VALUES (${title}, ${technologies}, ${summary}, ${outcome})
      RETURNING *
    `) as unknown as Record<string, unknown>[];
    return NextResponse.json({ success: true, evidence });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save evidence" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  if (!isAppRequestAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Evidence id is required" }, { status: 400 });
  try {
    await getDb()`DELETE FROM profile_evidence WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete evidence" },
      { status: 500 }
    );
  }
}
