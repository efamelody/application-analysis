import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "job_tracker_session";

function secret(
  name: string,
  env: Record<string, string | undefined> = process.env
): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function safeEqual(expectedValue: string, actualValue: string): boolean {
  const expected = Buffer.from(expectedValue);
  const actual = Buffer.from(actualValue);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function sessionValue(
  env: Record<string, string | undefined> = process.env
): string {
  return createHmac("sha256", secret("AUTH_SECRET", env))
    .update(`job-tracker:${secret("APP_PASSWORD", env)}`)
    .digest("hex");
}

function validSession(
  value: string | undefined,
  env: Record<string, string | undefined> = process.env
): boolean {
  if (!value) return false;
  try {
    return safeEqual(sessionValue(env), value);
  } catch {
    return false;
  }
}

export function isAppRequestAuthorized(
  request: Request,
  allowExtension = false,
  env: Record<string, string | undefined> = process.env
): boolean {
  const cookie = request.headers
    .get("cookie")
    ?.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1];
  if (validSession(cookie, env)) return true;
  const extensionToken = env.EXTENSION_ACCESS_TOKEN?.trim();
  const providedToken = request.headers.get("x-extension-token")?.trim();
  if (
    allowExtension &&
    extensionToken &&
    providedToken &&
    safeEqual(extensionToken, providedToken)
  ) {
    return true;
  }
  return false;
}

export function createSessionValue(
  env: Record<string, string | undefined> = process.env
): string {
  return sessionValue(env);
}

export async function hasAppSession(): Promise<boolean> {
  try {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    return validSession(store.get(SESSION_COOKIE)?.value);
  } catch {
    return false;
  }
}
