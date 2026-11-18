"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import type { CandidateProfile, ProfileEvidence } from "@/lib/profile";

type ProfileData = { profile: CandidateProfile; evidence: ProfileEvidence[] };

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700";

export function ProfileClient({
  initial,
  notice,
}: {
  initial: ProfileData;
  notice?: string;
}) {
  const [profile, setProfile] = useState(initial.profile);
  const [evidence, setEvidence] = useState(initial.evidence);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(notice ?? "");
  const [project, setProject] = useState({
    title: "",
    technologies: "",
    summary: "",
    outcome: "",
  });

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: profile.full_name,
          headline: profile.headline,
          master_cv: profile.master_cv,
          preferred_roles: profile.preferred_roles,
          preferred_locations: profile.preferred_locations,
          remote_preference: profile.remote_preference,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Failed to save profile");
      setProfile(json.profile);
      setMessage("Profile saved. Future job analyses will use these details.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  async function addEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/profile/evidence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(project),
    });
    const json = await response.json();
    if (!response.ok) {
      setMessage(json.error ?? "Failed to add project");
      return;
    }
    setEvidence((current) => [json.evidence, ...current]);
    setProject({ title: "", technologies: "", summary: "", outcome: "" });
    setMessage("Project evidence added.");
  }

  async function removeEvidence(id: string) {
    const response = await fetch(`/api/profile/evidence?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (response.ok) setEvidence((current) => current.filter((item) => item.id !== id));
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link className="text-sm text-violet-600 hover:underline dark:text-violet-400" href="/">
            ← Back to applications
          </Link>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Your CV profile</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            Keep one truthful master CV here. Job-specific suggestions and cover letters are drafts;
            they never overwrite this profile.
          </p>
        </div>
      </header>

      {message && (
        <p className="mb-5 rounded-lg bg-violet-50 p-3 text-sm text-violet-900 dark:bg-violet-950 dark:text-violet-100">
          {message}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <form onSubmit={saveProfile} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Master CV</h2>
            <p className="mt-1 text-xs text-zinc-500">Paste the complete text of your current CV. Keep your original PDF/DOCX locally for now.</p>
          </div>
          <div className="space-y-4">
            <label className="block text-sm font-medium">Full name<input className={`${inputClass} mt-1`} value={profile.full_name} onChange={(event) => setProfile({ ...profile, full_name: event.target.value })} /></label>
            <label className="block text-sm font-medium">Professional headline<input className={`${inputClass} mt-1`} value={profile.headline} onChange={(event) => setProfile({ ...profile, headline: event.target.value })} placeholder="Junior TypeScript Full-Stack Developer" /></label>
            <label className="block text-sm font-medium">Master CV<textarea className={`${inputClass} mt-1 min-h-80 resize-y font-mono text-xs`} value={profile.master_cv} onChange={(event) => setProfile({ ...profile, master_cv: event.target.value })} placeholder="Paste your complete CV text here..." /></label>
            <button disabled={saving} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50">{saving ? "Saving..." : "Save master CV"}</button>
          </div>
        </form>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-semibold">Search preferences</h2>
          <p className="mt-1 mb-5 text-xs text-zinc-500">These preferences guide the match score.</p>
          <div className="space-y-4">
            <label className="block text-sm font-medium">Preferred roles<input className={`${inputClass} mt-1`} value={profile.preferred_roles} onChange={(event) => setProfile({ ...profile, preferred_roles: event.target.value })} /></label>
            <label className="block text-sm font-medium">Preferred locations<input className={`${inputClass} mt-1`} value={profile.preferred_locations} onChange={(event) => setProfile({ ...profile, preferred_locations: event.target.value })} /></label>
            <label className="block text-sm font-medium">Remote preference<textarea className={`${inputClass} mt-1 min-h-24 resize-y`} value={profile.remote_preference} onChange={(event) => setProfile({ ...profile, remote_preference: event.target.value })} /></label>
            <p className="text-xs text-zinc-500">Save these fields with the master CV button.</p>
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-5">
          <h2 className="text-lg font-semibold">Projects and evidence</h2>
          <p className="mt-1 text-xs text-zinc-500">Add specific facts Gemini can reuse without inventing experience.</p>
        </div>
        <form onSubmit={addEvidence} className="grid gap-3 md:grid-cols-2">
          <input className={inputClass} required placeholder="Project name" value={project.title} onChange={(event) => setProject({ ...project, title: event.target.value })} />
          <input className={inputClass} placeholder="Technologies: Next.js, TypeScript..." value={project.technologies} onChange={(event) => setProject({ ...project, technologies: event.target.value })} />
          <textarea className={`${inputClass} min-h-24 resize-y`} required placeholder="What did you build?" value={project.summary} onChange={(event) => setProject({ ...project, summary: event.target.value })} />
          <textarea className={`${inputClass} min-h-24 resize-y`} placeholder="Outcome or measurable result" value={project.outcome} onChange={(event) => setProject({ ...project, outcome: event.target.value })} />
          <button className="w-fit rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">Add evidence</button>
        </form>
        {evidence.length > 0 && (
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {evidence.map((item) => (
              <article key={item.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                <div className="flex items-start justify-between gap-3"><h3 className="font-semibold">{item.title}</h3><button onClick={() => removeEvidence(item.id)} className="text-xs text-red-600 hover:underline">Remove</button></div>
                {item.technologies && <p className="mt-1 text-xs font-medium text-violet-600 dark:text-violet-400">{item.technologies}</p>}
                <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">{item.summary}</p>
                {item.outcome && <p className="mt-2 text-xs text-zinc-500">Outcome: {item.outcome}</p>}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
