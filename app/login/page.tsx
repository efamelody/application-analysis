"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (response.ok) router.push("/");
    else setError("Invalid password or authentication is not configured.");
    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-xl font-bold">Job Application Tracker</h1>
        <p className="mt-2 text-sm text-zinc-500">Enter your private app password.</p>
        <input className="mt-5 w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button disabled={loading} className="mt-4 w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{loading ? "Signing in..." : "Sign in"}</button>
      </form>
    </main>
  );
}
