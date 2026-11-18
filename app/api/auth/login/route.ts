import { NextResponse } from "next/server";
import { createSessionValue, SESSION_COOKIE } from "@/lib/auth";
import { z } from "zod";

const loginSchema = z.object({ password: z.string().min(1).max(500) });

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !process.env.APP_PASSWORD || parsed.data.password !== process.env.APP_PASSWORD) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  if (!process.env.AUTH_SECRET) {
    return NextResponse.json(
      { error: "Authentication is not configured: AUTH_SECRET is missing" },
      { status: 503 }
    );
  }

  try {
    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE, createSessionValue(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Authentication is not configured" },
      { status: 500 }
    );
  }
}
