import { z } from "zod";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

const DEFAULT_ALLOWED_SENDERS =
  "noreply@e.jobstreet.com,jobalerts-noreply@linkedin.com";

const REDIRECT_PARAM_KEYS = [
  "url",
  "target",
  "redirect",
  "redirect_url",
  "dest",
  "destination",
  "u",
  "href",
];

const TRACKING_PARAM_KEYS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "tracking",
  "trackingid",
  "refid",
  "lipi",
  "trk",
  "trkemail",
  "eid",
  "midtoken",
  "midsig",
  "icmpid",
  "savedsearchid",
  "alertid",
  "fbclid",
  "gclid",
]);

const NON_LISTING_URL_PATTERNS = [
  /\/unsubscribe/i,
  /\/mypreferences/i,
  /\/preferences/i,
  /\/notifications/i,
  /\/help\//i,
  /\/privacy/i,
  /\/legal/i,
  /\/settings/i,
  /\/login/i,
  /\/signin/i,
  /\.(?:png|jpe?g|gif|svg|webp|ico|css|js)$/i,
];

interface GmailMessagePart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailMessagePart[];
}

interface GmailPayload extends GmailMessagePart {
  headers?: Array<{ name: string; value: string }>;
}

interface GmailMessage {
  id: string;
  payload?: GmailPayload;
}

function requiredEnv(name: string, env: Record<string, string | undefined> = process.env): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&bull;|&middot;/gi, "·")
    .replace(/&ndash;/gi, "–")
    .replace(/&mdash;/gi, "—")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, dec: string) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/&amp;/gi, "&");
}

function collectBody(part: GmailMessagePart | undefined, wanted: string): string {
  if (!part) return "";
  if (part.mimeType === wanted && part.body?.data) return decodeBase64Url(part.body.data);
  for (const child of part.parts ?? []) {
    const value = collectBody(child, wanted);
    if (value) return value;
  }
  return "";
}

function header(message: GmailMessage, name: string): string {
  return (
    message.payload?.headers?.find(
      (item) => item.name.toLowerCase() === name.toLowerCase()
    )?.value ?? ""
  );
}

export function senderAddress(value: string): string {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] ?? value)
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .trim()
    .toLowerCase();
}

export function parseAllowedSenders(raw?: string): string[] {
  return (raw ?? DEFAULT_ALLOWED_SENDERS)
    .split(",")
    .map((value) => senderAddress(value))
    .filter(Boolean);
}

export function safeListingUrl(value: string | null | undefined): string {
  if (!value) return "";
  const cleaned = decodeHtmlEntities(value).trim();
  if (!cleaned || /\s/.test(cleaned)) return "";

  let url: URL;
  try {
    url = new URL(cleaned);
  } catch {
    return "";
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return "";
  }

  for (const key of REDIRECT_PARAM_KEYS) {
    const nested = url.searchParams.get(key);
    if (nested && /^https?:\/\//i.test(nested)) {
      const unwrapped = safeListingUrl(nested);
      if (unwrapped) return unwrapped;
    }
  }

  if (
    NON_LISTING_URL_PATTERNS.some(
      (pattern) => pattern.test(url.pathname) || pattern.test(url.search)
    )
  ) {
    return "";
  }

  if (
    url.hostname.toLowerCase().endsWith("linkedin.com") &&
    url.pathname.startsWith("/comm/jobs/view/")
  ) {
    url.pathname = url.pathname.replace(/^\/comm\/jobs\/view\//, "/jobs/view/");
  }

  const keysToDelete: string[] = [];
  for (const key of url.searchParams.keys()) {
    if (TRACKING_PARAM_KEYS.has(key.toLowerCase())) {
      keysToDelete.push(key);
    }
  }
  for (const key of keysToDelete) {
    url.searchParams.delete(key);
  }

  url.hash = "";
  return url.toString();
}

export function extractCandidateListingUrls(raw: string): string[] {
  if (!raw) return [];
  const candidates: string[] = [];

  const hrefRegex = /<a\b[^>]*?\bhref\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>"']+))/gi;
  let match: RegExpExecArray | null;
  while ((match = hrefRegex.exec(raw)) !== null) {
    const href = match[1] ?? match[2] ?? match[3] ?? "";
    const safe = safeListingUrl(href);
    if (safe) candidates.push(safe);
  }

  const plainUrlRegex = /https?:\/\/[^\s"'<>)\]]+/gi;
  while ((match = plainUrlRegex.exec(raw)) !== null) {
    const rawUrl = match[0].replace(/[.,;:!?]+$/, "");
    const safe = safeListingUrl(rawUrl);
    if (safe) candidates.push(safe);
  }

  return Array.from(new Set(candidates));
}

export function extractHtmlTextAndLinks(
  html: string,
  maxChars = 12000
): { text: string; links: string[] } {
  if (!html) return { text: "", links: [] };

  const withoutBoilerplate = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");

  const links = extractCandidateListingUrls(withoutBoilerplate);

  const withInlineLinks = withoutBoilerplate.replace(
    /<a\b[^>]*?\bhref\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>"']+))[^>]*>([\s\S]*?)<\/a>/gi,
    (_, dHref: string, sHref: string, uHref: string, innerHtml: string) => {
      const anchorText = decodeHtmlEntities(innerHtml.replace(/<[^>]+>/g, " "))
        .replace(/\s+/g, " ")
        .trim();
      const safe = safeListingUrl(dHref ?? sHref ?? uHref ?? "");
      if (!safe) return anchorText ? ` ${anchorText} ` : " ";
      return anchorText ? ` ${anchorText} (${safe}) ` : ` ${safe} `;
    }
  );

  const text = decodeHtmlEntities(
    withInlineLinks
      .replace(/<\/(?:p|div|tr|li|h[1-6]|section|article|header|footer)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim()
    .slice(0, maxChars);

  return { text, links };
}

export function normalizeCompanyName(value: string | null | undefined): string {
  if (!value) return "";
  return decodeHtmlEntities(value)
    .replace(/\s+/g, " ")
    .replace(/^[\s•·|\-–—:;,.]+|[\s•·|\-–—:;,.]+$/g, "")
    .trim();
}

export function normalizeJobTitle(value: string | null | undefined): string {
  if (!value) return "";
  return decodeHtmlEntities(value)
    .replace(/\s+/g, " ")
    .replace(/^[\s•·|\-–—]+|[\s•·|\-–—]+$/g, "")
    .trim();
}

const nullableTrimmedString = z
  .string()
  .nullable()
  .optional()
  .transform((val) => {
    const cleaned = decodeHtmlEntities(val ?? "").replace(/\s+/g, " ").trim();
    if (/^(?:n\/a|not specified|none|unknown|null|undefined|-)$/i.test(cleaned)) {
      return "";
    }
    return cleaned;
  });

export const jobAlertSchema = z.object({
  company_name: z
    .string()
    .nullable()
    .optional()
    .transform((val) => normalizeCompanyName(val)),
  job_title: z
    .string()
    .nullable()
    .optional()
    .transform((val) => normalizeJobTitle(val)),
  job_url: z
    .string()
    .nullable()
    .optional()
    .transform((val) => safeListingUrl(val)),
  location: nullableTrimmedString,
  salary_range: nullableTrimmedString,
  is_remote: z
    .boolean()
    .nullable()
    .optional()
    .transform((val) => Boolean(val)),
  training_signals: nullableTrimmedString,
  match_score: z
    .union([z.number(), z.string()])
    .transform((val) => {
      const num = typeof val === "number" ? val : Number(val);
      if (!Number.isFinite(num)) return 0;
      return Math.max(0, Math.min(100, Math.round(num)));
    }),
  strengths: nullableTrimmedString,
  gaps_and_risks: nullableTrimmedString,
  cv_suggestions: nullableTrimmedString,
  improvement_action_item: nullableTrimmedString,
});

export type ParsedJobAlertResult = z.infer<typeof jobAlertSchema>;

export function parseJobAlertResult(
  raw: unknown,
  fallbackLinks: string[] = []
): ParsedJobAlertResult {
  const candidate = Array.isArray(raw) ? raw[0] ?? {} : raw;
  const parsed = jobAlertSchema.parse(candidate);
  if (!parsed.job_url && fallbackLinks.length > 0) {
    const validFallback = safeListingUrl(fallbackLinks[0]);
    if (validFallback) {
      parsed.job_url = validFallback;
    }
  }
  return parsed;
}

async function getAccessToken(
  fetchImpl: typeof fetch,
  env: Record<string, string | undefined>
): Promise<string> {
  const response = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requiredEnv("GMAIL_CLIENT_ID", env),
      client_secret: requiredEnv("GMAIL_CLIENT_SECRET", env),
      refresh_token: requiredEnv("GMAIL_REFRESH_TOKEN", env),
      grant_type: "refresh_token",
    }),
  });
  const json = await response.json();
  if (!response.ok || typeof json.access_token !== "string") {
    throw new Error(
      `Gmail token refresh failed: ${json.error_description ?? response.statusText}`
    );
  }
  return json.access_token;
}

async function gmailFetch<T>(
  fetchImpl: typeof fetch,
  accessToken: string,
  path: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`${GMAIL_API}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, value);
  }
  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(`Gmail API failed: ${json.error?.message ?? response.statusText}`);
  }
  return json as T;
}

export interface JobAlertEmail {
  id: string;
  from: string;
  subject: string;
  receivedAt: string;
  text: string;
  links: string[];
}

export async function getJobAlertEmails(options?: {
  fetchImpl?: typeof fetch;
  env?: Record<string, string | undefined>;
}): Promise<JobAlertEmail[]> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const env = options?.env ?? process.env;
  const allowedSenders = parseAllowedSenders(env.GMAIL_ALLOWED_SENDERS);
  if (allowedSenders.length === 0) throw new Error("GMAIL_ALLOWED_SENDERS is empty");
  const accessToken = await getAccessToken(fetchImpl, env);
  const query = `label:"Job Alerts" newer_than:7d {${allowedSenders
    .map((sender) => `from:${sender}`)
    .join(" ")}}`;
  const messageIds: Array<{ id: string }> = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 5; page += 1) {
    const listed = await gmailFetch<{
      messages?: Array<{ id: string }>;
      nextPageToken?: string;
    }>(fetchImpl, accessToken, "/messages", {
      q: query,
      maxResults: "100",
      ...(pageToken ? { pageToken } : {}),
    });
    messageIds.push(...(listed.messages ?? []));
    pageToken = listed.nextPageToken;
    if (!pageToken) break;
  }
  const messages = await Promise.all(
    messageIds.map(({ id }) =>
      gmailFetch<GmailMessage>(fetchImpl, accessToken, `/messages/${id}`, {
        format: "full",
      })
    )
  );
  return messages
    .map((message) => {
      const plainRaw = collectBody(message.payload, "text/plain");
      const htmlRaw = collectBody(message.payload, "text/html");
      const htmlExtracted = htmlRaw
        ? extractHtmlTextAndLinks(htmlRaw)
        : { text: "", links: [] };
      const plainExtracted = plainRaw
        ? plainRaw.includes("<") && plainRaw.includes(">")
          ? extractHtmlTextAndLinks(plainRaw)
          : {
              text: plainRaw.slice(0, 12000).trim(),
              links: extractCandidateListingUrls(plainRaw),
            }
        : { text: "", links: [] };

      const text = (htmlExtracted.text || plainExtracted.text).slice(0, 12000);
      const links = Array.from(
        new Set([...htmlExtracted.links, ...plainExtracted.links])
      ).slice(0, 20);

      return {
        id: message.id,
        from: senderAddress(header(message, "From")),
        subject: header(message, "Subject"),
        receivedAt: header(message, "Date"),
        text,
        links,
      };
    })
    .filter((email) => allowedSenders.includes(email.from) && Boolean(email.text));
}

export interface JobAlertsCronSummary {
  success: true;
  messagesFound: number;
  jobsCreated: number;
  duplicatesSkipped: number;
  nonJobSkipped: number;
  aiExtractionFailures: number;
  databaseFailures: number;
  // Backwards-compatible aliases
  emails: number;
  created: number;
  skipped: number;
  failed: number;
}

export async function processJobAlerts(options: {
  emails: JobAlertEmail[];
  profilePrompt: string;
  checkAlreadyProcessed: (messageId: string) => Promise<boolean>;
  extractJob: (email: JobAlertEmail, prompt: string) => Promise<unknown>;
  insertJob: (email: JobAlertEmail, result: ParsedJobAlertResult) => Promise<boolean>;
  onErrorLog?: (entry: {
    event: "job_alerts_message_error";
    messageId: string;
    stage: "ai_extraction" | "database";
    errorType: string;
  }) => void;
}): Promise<JobAlertsCronSummary> {
  let jobsCreated = 0;
  let duplicatesSkipped = 0;
  let nonJobSkipped = 0;
  let aiExtractionFailures = 0;
  let databaseFailures = 0;

  for (const email of options.emails) {
    let alreadyProcessed = false;
    try {
      alreadyProcessed = await options.checkAlreadyProcessed(email.id);
    } catch (error) {
      databaseFailures += 1;
      options.onErrorLog?.({
        event: "job_alerts_message_error",
        messageId: email.id,
        stage: "database",
        errorType: error instanceof Error ? error.name : "DatabaseError",
      });
      continue;
    }

    if (alreadyProcessed) {
      duplicatesSkipped += 1;
      continue;
    }

    const candidateLinksSection =
      email.links.length > 0
        ? `\nExtracted candidate job listing URLs:\n${email.links
            .map((link, i) => `${i + 1}. ${link}`)
            .join("\n")}\n`
        : "";

    const prompt = `You extract job listings and evaluate them for one candidate.

Candidate profile:
${options.profilePrompt}

Email sender: ${email.from}
Email subject: ${email.subject}${candidateLinksSection}
Job alert content:
${email.text}

If the email contains multiple job listings, select the single best-matching role for the candidate profile and pair it with its matching job_url from the extracted URLs above. Ignore unsubscribe, preferences, or footer links.

Return ONLY JSON with this exact structure:
{
  "company_name": "string",
  "job_title": "string",
  "job_url": "the canonical http/https application or listing URL, or empty string",
  "location": "string or empty string",
  "salary_range": "string or empty string",
  "is_remote": true,
  "training_signals": "training, mentorship, or junior-friendly signals",
  "match_score": 0,
  "strengths": "brief honest matches",
  "gaps_and_risks": "brief honest gaps",
  "cv_suggestions": "specific CV changes supported by the candidate profile",
  "improvement_action_item": "one next action"
}

Do not invent candidate experience. If the email is not a usable job listing, leave company_name and job_title empty.`;

    let result: ParsedJobAlertResult;
    try {
      const raw = await options.extractJob(email, prompt);
      result = parseJobAlertResult(raw, email.links);
    } catch (error) {
      aiExtractionFailures += 1;
      options.onErrorLog?.({
        event: "job_alerts_message_error",
        messageId: email.id,
        stage: "ai_extraction",
        errorType: error instanceof Error ? error.name : "AIExtractionError",
      });
      continue;
    }

    if (!result.company_name || !result.job_title) {
      nonJobSkipped += 1;
      continue;
    }

    try {
      const inserted = await options.insertJob(email, result);
      if (inserted) jobsCreated += 1;
      else duplicatesSkipped += 1;
    } catch (error) {
      databaseFailures += 1;
      options.onErrorLog?.({
        event: "job_alerts_message_error",
        messageId: email.id,
        stage: "database",
        errorType: error instanceof Error ? error.name : "DatabaseInsertError",
      });
    }
  }

  const skipped = duplicatesSkipped + nonJobSkipped;
  const failed = aiExtractionFailures + databaseFailures;

  return {
    success: true,
    messagesFound: options.emails.length,
    jobsCreated,
    duplicatesSkipped,
    nonJobSkipped,
    aiExtractionFailures,
    databaseFailures,
    emails: options.emails.length,
    created: jobsCreated,
    skipped,
    failed,
  };
}
