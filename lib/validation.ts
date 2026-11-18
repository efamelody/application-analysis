import { z } from "zod";
import type { AppStatus } from "./types.ts";

function isValidHttpUrl(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export const createApplicationSchema = z.object({
  company_name: z.string().trim().min(1).max(200),
  job_title: z.string().trim().min(1).max(300),
  job_url: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .default("")
    .refine(isValidHttpUrl, {
      message: "job_url must be an absolute http or https URL",
    }),
  job_description: z.string().max(20000).optional().default(""),
  salary_range: z.string().max(300).optional().default(""),
});

export const generateCoverLetterSchema = z.object({
  id: z.string().uuid(),
});

export const emailWebhookSchema = z.object({
  // Resend-style
  text: z.string().optional(),
  html: z.string().optional(),
  subject: z.string().optional(),
  from: z.string().optional(),
  // Mailgun-style
  "body-plain": z.string().optional(),
  "stripped-text": z.string().optional(),
  stripped: z.string().optional(),
  "body-html": z.string().optional(),
  Subject: z.string().optional(),
  From: z.string().optional(),
});

export const profileSchema = z.object({
  full_name: z.string().trim().max(200),
  headline: z.string().trim().max(300),
  master_cv: z.string().max(30000),
  preferred_roles: z.string().trim().max(500),
  preferred_locations: z.string().trim().max(500),
  remote_preference: z.string().trim().max(1000),
});

export const evidenceSchema = z.object({
  title: z.string().trim().min(1).max(200),
  technologies: z.string().trim().max(500),
  summary: z.string().trim().min(1).max(3000),
  outcome: z.string().trim().max(1000),
});

export const appStatusSchema = z.enum([
  "discovered",
  "reviewing",
  "shortlisted",
  "applied",
  "viewed",
  "interviewing",
  "unlikely_to_progress",
  "rejected",
  "closed",
]);

export const updateApplicationStatusSchema = z.object({
  id: z.string().uuid(),
  status: appStatusSchema,
});

export interface ReviewWorkflowAction {
  status: AppStatus;
  label: string;
  tone: "primary" | "danger" | "neutral";
}

export function getReviewWorkflowActions(
  status: AppStatus
): ReviewWorkflowAction[] {
  switch (status) {
    case "discovered":
      return [
        { status: "reviewing", label: "Start reviewing", tone: "primary" },
        { status: "shortlisted", label: "Shortlist", tone: "neutral" },
        { status: "rejected", label: "Reject", tone: "danger" },
        { status: "closed", label: "Archive", tone: "neutral" },
      ];
    case "reviewing":
      return [
        { status: "shortlisted", label: "Shortlist", tone: "primary" },
        { status: "applied", label: "Mark applied", tone: "neutral" },
        { status: "rejected", label: "Reject", tone: "danger" },
        { status: "closed", label: "Archive", tone: "neutral" },
      ];
    case "shortlisted":
      return [
        { status: "applied", label: "Mark applied", tone: "primary" },
        { status: "reviewing", label: "Back to review", tone: "neutral" },
        { status: "rejected", label: "Reject", tone: "danger" },
        { status: "closed", label: "Archive", tone: "neutral" },
      ];
    case "applied":
    case "viewed":
    case "unlikely_to_progress":
      return [
        { status: "interviewing", label: "Interviewing", tone: "primary" },
        { status: "rejected", label: "Reject", tone: "danger" },
        { status: "closed", label: "Archive", tone: "neutral" },
      ];
    case "interviewing":
      return [
        { status: "rejected", label: "Reject", tone: "danger" },
        { status: "closed", label: "Archive", tone: "neutral" },
      ];
    case "rejected":
    case "closed":
      return [
        { status: "reviewing", label: "Reopen for review", tone: "neutral" },
      ];
  }
}

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
