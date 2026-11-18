"use client";

import { useMemo, useState } from "react";
import type { Application, AppStatus } from "@/lib/types";
import { getReviewWorkflowActions } from "@/lib/validation";

const STATUS_STYLES: Record<AppStatus, string> = {
  discovered: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
  reviewing: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  shortlisted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  applied: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  viewed: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  interviewing:
    "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  unlikely_to_progress:
    "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  closed: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
};

const ACTION_STYLES = {
  primary:
    "border-violet-600 bg-violet-600 text-white hover:bg-violet-700 dark:border-violet-500 dark:bg-violet-600 dark:hover:bg-violet-500",
  danger:
    "border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950",
  neutral:
    "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800",
} as const;

export function StatusBadge({ status }: { status: AppStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

function ScoreBar({ score }: { score: number | null }) {
  if (score === null || score === undefined)
    return <span className="text-xs text-zinc-500">—</span>;
  const color =
    score >= 75 ? "bg-green-500" : score >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
        <div className={`h-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-semibold">{score}</span>
    </div>
  );
}

function CoverLetterPanel({
  app,
  onUpdate,
}: {
  app: Application;
  onUpdate?: (updated: Application) => void;
}) {
  const [letter, setLetter] = useState(app.cover_letter_content ?? "");
  const [type, setType] = useState(app.cover_letter_type);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generateCustom() {
    setLoading(true);
    try {
      const res = await fetch("/api/applications/generate-cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: app.id }),
      });
      const json = await res.json();
      if (json.success && json.application) {
        setLetter(json.application.cover_letter_content ?? "");
        setType("custom");
        onUpdate?.(json.application as Application);
      } else {
        alert(json.error ?? "Generation failed");
      }
    } catch {
      alert("Network error generating cover letter");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(letter);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mt-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Cover letter · {type}
        </span>
        <button
          onClick={copy}
          className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
        {type === "generic" && (
          <button
            onClick={generateCustom}
            disabled={loading}
            className="rounded-md bg-violet-600 px-2 py-1 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {loading ? "Generating…" : "🪄 Generate Custom Cover Letter"}
          </button>
        )}
      </div>
      <pre className="whitespace-pre-wrap text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
        {letter || "No cover letter yet."}
      </pre>
    </div>
  );
}

export function ApplicationCard({
  app,
  onUpdate,
}: {
  app: Application;
  onUpdate?: (updated: Application) => void;
}) {
  const [open, setOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<AppStatus | null>(null);
  const [statusError, setStatusError] = useState("");
  const actions = getReviewWorkflowActions(app.status);

  async function updateStatus(nextStatus: AppStatus) {
    setUpdatingStatus(nextStatus);
    setStatusError("");
    try {
      const res = await fetch("/api/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: app.id, status: nextStatus }),
      });
      const json = await res.json();
      if (!res.ok || !json.success || !json.application) {
        setStatusError(json.error ?? "Failed to update status");
        return;
      }
      onUpdate?.(json.application as Application);
    } catch {
      setStatusError("Network error updating status");
    } finally {
      setUpdatingStatus(null);
    }
  }

  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
            {app.job_title}
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {app.company_name}
            {app.salary_range ? ` · ${app.salary_range}` : ""}
          </p>
          {(app.location || app.is_remote || app.source) && (
            <p className="text-xs text-zinc-500">
              {[app.location, app.is_remote ? "Remote" : null, app.source]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          {app.training_signals && (
            <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
              Training signals: {app.training_signals}
            </p>
          )}
          {app.job_url && (
            <a
              href={app.job_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              View listing
            </a>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={app.status} />
          <ScoreBar score={app.match_score} />
        </div>
      </div>

      {(app.strengths || app.gaps_and_risks || app.improvement_action_item) && (
        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
          {app.strengths && (
            <div className="rounded-lg bg-green-50 p-2 dark:bg-green-950">
              <p className="font-semibold text-green-800 dark:text-green-200">
                Strengths
              </p>
              <p className="text-green-900 dark:text-green-100">{app.strengths}</p>
            </div>
          )}
          {app.gaps_and_risks && (
            <div className="rounded-lg bg-amber-50 p-2 dark:bg-amber-950">
              <p className="font-semibold text-amber-800 dark:text-amber-200">
                Gaps &amp; Risks
              </p>
              <p className="text-amber-900 dark:text-amber-100">
                {app.gaps_and_risks}
              </p>
            </div>
          )}
          {app.improvement_action_item && (
            <div className="rounded-lg bg-blue-50 p-2 dark:bg-blue-950">
              <p className="font-semibold text-blue-800 dark:text-blue-200">
                Action item
              </p>
              <p className="text-blue-900 dark:text-blue-100">
                {app.improvement_action_item}
              </p>
            </div>
          )}
        </div>
      )}

      {app.cv_suggestions && (
        <div className="mt-2 rounded-lg bg-violet-50 p-2 text-xs dark:bg-violet-950">
          <p className="font-semibold text-violet-800 dark:text-violet-200">
            CV suggestions
          </p>
          <p className="text-violet-900 dark:text-violet-100">
            {app.cv_suggestions}
          </p>
        </div>
      )}

      {app.last_email_snippet && (
        <p className="mt-2 truncate text-xs italic text-zinc-500">
          Last email: {app.last_email_snippet}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <div className="flex flex-wrap items-center gap-1.5">
          {actions.map((action) => (
            <button
              key={action.status}
              type="button"
              disabled={updatingStatus !== null}
              onClick={() => updateStatus(action.status)}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${ACTION_STYLES[action.tone]}`}
            >
              {updatingStatus === action.status ? "Saving…" : action.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs font-medium text-zinc-600 hover:underline dark:text-zinc-300"
        >
          {open ? "Hide cover letter ▲" : "Show cover letter ▼"}
        </button>
      </div>

      {statusError && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
          {statusError}
        </p>
      )}

      {open && <CoverLetterPanel app={app} onUpdate={onUpdate} />}
    </article>
  );
}

export function DashboardClient({
  initial,
  notice,
}: {
  initial: Application[];
  notice?: string;
}) {
  const [apps, setApps] = useState<Application[]>(initial);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  function handleUpdateApplication(updated: Application) {
    setApps((current) =>
      current.map((item) => (item.id === updated.id ? updated : item))
    );
  }

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return apps.filter(
      (a) =>
        (statusFilter === "all" || a.status === statusFilter) &&
        (!q ||
          a.company_name.toLowerCase().includes(q) ||
          a.job_title.toLowerCase().includes(q))
    );
  }, [apps, query, statusFilter]);

  const stats = useMemo(() => {
    const by: Record<string, number> = {};
    for (const a of apps) by[a.status] = (by[a.status] ?? 0) + 1;
    return by;
  }, [apps]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">
          Job Application Tracker
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {apps.length} applications
          {Object.entries(stats)
            .map(([s, n]) => ` · ${s.replaceAll("_", " ")}: ${n}`)
            .join("")}
        </p>
        <a
          href="/profile"
          className="mt-3 inline-block text-sm font-medium text-violet-600 hover:underline dark:text-violet-400"
        >
          Edit CV profile and project evidence →
        </a>
        {notice && (
          <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            {notice}
          </p>
        )}
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search company or title…"
          className="min-w-52 flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
        >
          <option value="all">All statuses</option>
          <option value="discovered">Discovered</option>
          <option value="reviewing">Reviewing</option>
          <option value="shortlisted">Shortlisted</option>
          <option value="applied">Applied</option>
          <option value="viewed">Viewed</option>
          <option value="interviewing">Interviewing</option>
          <option value="unlikely_to_progress">Unlikely to progress</option>
          <option value="rejected">Rejected</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No applications yet. Click the Chrome extension on a JobStreet listing
          to save your first one.
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((a) => (
            <ApplicationCard
              key={a.id}
              app={a}
              onUpdate={handleUpdateApplication}
            />
          ))}
        </div>
      )}
    </div>
  );
}
