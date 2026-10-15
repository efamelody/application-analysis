import { z } from "zod";

export const createApplicationSchema = z.object({
  company_name: z.string().trim().min(1).max(200),
  job_title: z.string().trim().min(1).max(300),
  job_url: z.string().trim().max(2000).optional().default(""),
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

export const appStatusSchema = z.enum([
  "applied",
  "viewed",
  "interviewing",
  "unlikely_to_progress",
  "rejected",
  "closed",
]);

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
