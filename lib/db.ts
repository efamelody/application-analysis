import { neon } from "@neondatabase/serverless";

let cached: ReturnType<typeof neon> | null = null;

/** Server-only Neon client. Keep DATABASE_URL out of client components. */
export function getDb() {
  if (cached) return cached;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Missing DATABASE_URL");
  cached = neon(connectionString);
  return cached;
}
