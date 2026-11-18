import test from "node:test";
import assert from "node:assert/strict";
import {
  senderAddress,
  parseAllowedSenders,
  extractHtmlTextAndLinks,
  safeListingUrl,
  extractCandidateListingUrls,
  normalizeCompanyName,
  parseJobAlertResult,
  getJobAlertEmails,
  processJobAlerts,
} from "../lib/gmail.ts";

test("senderAddress normalizes display names, angle brackets, quotes, and case", () => {
  assert.equal(
    senderAddress('"JobStreet Job Alerts" <NOREPLY@e.jobstreet.com>'),
    "noreply@e.jobstreet.com"
  );
  assert.equal(
    senderAddress("LinkedIn Alerts <jobalerts-noreply@linkedin.com>"),
    "jobalerts-noreply@linkedin.com"
  );
  assert.equal(senderAddress("  noreply@e.jobstreet.com "), "noreply@e.jobstreet.com");
});

test("parseAllowedSenders matches exact normalized sender addresses only", () => {
  const allowed = parseAllowedSenders(
    "noreply@e.jobstreet.com, jobalerts-noreply@linkedin.com"
  );
  assert.equal(allowed.includes("noreply@e.jobstreet.com"), true);
  assert.equal(allowed.includes("jobalerts-noreply@linkedin.com"), true);
  assert.equal(allowed.includes("spoofed-noreply@e.jobstreet.com.evil.com"), false);
  assert.equal(allowed.includes("newsletter@example.com"), false);
});

test("extractHtmlTextAndLinks strips large style/script blocks before truncating and preserves job links", () => {
  const hugeCss = "body { color: red; } ".repeat(800);
  const html = `
    <html>
      <head><style>${hugeCss}</style><script>console.log("secret")</script></head>
      <body>
        <div>
          <h2>Junior TypeScript Developer</h2>
          <p>Acme &amp; Co (M) Sdn. Bhd. &bull; Kuala Lumpur</p>
          <a href="https://www.jobstreet.com.my/en/job/123456?utm_source=email&amp;tracking=abc">View job on JobStreet</a>
          <a href="https://www.jobstreet.com.my/unsubscribe?token=xyz">Unsubscribe</a>
        </div>
      </body>
    </html>
  `;
  const { text, links } = extractHtmlTextAndLinks(html);
  assert.match(text, /Junior TypeScript Developer/);
  assert.match(text, /Acme & Co \(M\) Sdn\. Bhd\./);
  assert.equal(text.includes("color: red"), false);
  assert.equal(
    links.includes("https://www.jobstreet.com.my/en/job/123456"),
    true
  );
  assert.equal(
    links.some((link) => link.includes("unsubscribe")),
    false
  );
});

test("safeListingUrl rejects non-http(s) and unwraps/cleans tracking URLs", () => {
  assert.equal(safeListingUrl("javascript:alert(1)"), "");
  assert.equal(safeListingUrl("mailto:hr@example.com"), "");
  assert.equal(safeListingUrl("/relative/job/123"), "");
  assert.equal(
    safeListingUrl("https://www.linkedin.com/help/linkedin/ unsubscribe"),
    ""
  );
  assert.equal(
    safeListingUrl(
      "https://click.e.jobstreet.com/?qs=123&url=https%3A%2F%2Fmy.jobstreet.com%2Fjob%2F987654%3Futm_source%3Dalert%26tracking%3Dfoo"
    ),
    "https://my.jobstreet.com/job/987654"
  );
  assert.equal(
    safeListingUrl(
      "https://www.linkedin.com/comm/jobs/view/4123456789/?trackingId=abc&refId=def&lipi=urn%3Ali%3Apage"
    ),
    "https://www.linkedin.com/jobs/view/4123456789/"
  );
});

test("extractCandidateListingUrls handles multiple job links in one email and filters footers", () => {
  const raw = `
    Check out these jobs:
    1. https://www.linkedin.com/comm/jobs/view/111111/?trackingId=t1&utm_source=alert
    2. https://my.jobstreet.com/job/222222?tracking=t2
    Manage alerts: https://www.linkedin.com/mypreferences/d/unsubscribe?token=abc
  `;
  const urls = extractCandidateListingUrls(raw);
  assert.deepEqual(urls, [
    "https://www.linkedin.com/jobs/view/111111/",
    "https://my.jobstreet.com/job/222222",
  ]);
});

test("normalizeCompanyName cleans unusual company formatting and HTML entities", () => {
  assert.equal(
    normalizeCompanyName("  •  TechCorp &amp; Partners\n  (Malaysia)   Sdn Bhd | "),
    "TechCorp & Partners (Malaysia) Sdn Bhd"
  );
});

test("parseJobAlertResult tolerates null salary/location and clamps match_score", () => {
  const parsed = parseJobAlertResult({
    company_name: " • Example &amp; Co Sdn Bhd ",
    job_title: " Junior Full-Stack TypeScript Engineer ",
    job_url:
      "https://www.linkedin.com/comm/jobs/view/999999/?trackingId=xyz&utm_medium=email",
    location: null,
    salary_range: null,
    is_remote: null,
    training_signals: null,
    match_score: 88,
    strengths: "Strong TypeScript and Next.js overlap.",
    gaps_and_risks: "Location not stated in alert.",
    cv_suggestions: "Highlight the Next.js dashboard project.",
    improvement_action_item: "Check location on listing page.",
  });

  assert.equal(parsed.company_name, "Example & Co Sdn Bhd");
  assert.equal(parsed.job_title, "Junior Full-Stack TypeScript Engineer");
  assert.equal(parsed.job_url, "https://www.linkedin.com/jobs/view/999999/");
  assert.equal(parsed.location, "");
  assert.equal(parsed.salary_range, "");
  assert.equal(parsed.is_remote, false);
  assert.equal(parsed.training_signals, "");
  assert.equal(parsed.match_score, 88);
});

test("getJobAlertEmails paginates up to 5 pages and filters unapproved senders", async () => {
  const encode = (str: string) =>
    Buffer.from(str, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const pages: Record<string, { messages: Array<{ id: string }>; nextPageToken?: string }> = {
    first: { messages: [{ id: "m1" }], nextPageToken: "p2" },
    p2: { messages: [{ id: "m2" }], nextPageToken: "p3" },
    p3: { messages: [{ id: "m3" }] },
  };

  const messagesById: Record<string, unknown> = {
    m1: {
      id: "m1",
      payload: {
        headers: [
          { name: "From", value: "JobStreet <noreply@e.jobstreet.com>" },
          { name: "Subject", value: "New TypeScript job" },
          { name: "Date", value: "Tue, 10 Nov 2026 01:00:00 +0000" },
        ],
        mimeType: "text/html",
        body: {
          data: encode(
            `<p>Junior Developer at Beta Sdn Bhd</p><a href="https://my.jobstreet.com/job/55555?utm_source=email">Apply</a>`
          ),
        },
      },
    },
    m2: {
      id: "m2",
      payload: {
        headers: [
          { name: "From", value: "LinkedIn <jobalerts-noreply@linkedin.com>" },
          { name: "Subject", value: "Jobs for you" },
          { name: "Date", value: "Tue, 10 Nov 2026 01:05:00 +0000" },
        ],
        mimeType: "text/plain",
        body: {
          data: encode(
            "Full Stack Developer at Gamma Corp https://www.linkedin.com/comm/jobs/view/77777/?trackingId=1"
          ),
        },
      },
    },
    m3: {
      id: "m3",
      payload: {
        headers: [
          { name: "From", value: "Other <unrelated@example.com>" },
          { name: "Subject", value: "Promo" },
          { name: "Date", value: "Tue, 10 Nov 2026 01:10:00 +0000" },
        ],
        mimeType: "text/plain",
        body: { data: encode("Ignore me") },
      },
    },
  };

  const fakeFetch: typeof fetch = async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url === "https://oauth2.googleapis.com/token") {
      return new Response(JSON.stringify({ access_token: "tok" }), { status: 200 });
    }
    const parsed = new URL(url);
    if (parsed.pathname.endsWith("/messages")) {
      const token = parsed.searchParams.get("pageToken") ?? "first";
      return new Response(JSON.stringify(pages[token]), { status: 200 });
    }
    const id = parsed.pathname.split("/").pop() ?? "";
    return new Response(JSON.stringify(messagesById[id]), { status: 200 });
  };

  const emails = await getJobAlertEmails({
    fetchImpl: fakeFetch,
    env: {
      GMAIL_CLIENT_ID: "cid",
      GMAIL_CLIENT_SECRET: "csecret",
      GMAIL_REFRESH_TOKEN: "rtoken",
      GMAIL_ALLOWED_SENDERS: "noreply@e.jobstreet.com,jobalerts-noreply@linkedin.com",
    },
  });

  assert.equal(emails.length, 2);
  assert.equal(emails[0].id, "m1");
  assert.equal(emails[0].from, "noreply@e.jobstreet.com");
  assert.equal(emails[0].links.includes("https://my.jobstreet.com/job/55555"), true);
  assert.equal(emails[1].id, "m2");
  assert.equal(emails[1].from, "jobalerts-noreply@linkedin.com");
});

test("processJobAlerts deduplicates repeat runs and tracks AI and DB failure metrics safely", async () => {
  const seenMessageIds = new Set<string>();
  const sampleEmails = [
    {
      id: "msg-1",
      from: "noreply@e.jobstreet.com",
      subject: "Junior TS Dev",
      receivedAt: "2026-11-10",
      text: "Junior TS Dev at Delta Sdn Bhd",
      links: ["https://my.jobstreet.com/job/101"],
    },
    {
      id: "msg-ai-fail",
      from: "jobalerts-noreply@linkedin.com",
      subject: "Broken JSON",
      receivedAt: "2026-11-10",
      text: "Some role",
      links: [],
    },
    {
      id: "msg-db-fail",
      from: "noreply@e.jobstreet.com",
      subject: "DB Error Role",
      receivedAt: "2026-11-10",
      text: "Engineer at Epsilon",
      links: ["https://my.jobstreet.com/job/202"],
    },
  ];

  const runOnce = () =>
    processJobAlerts({
      emails: sampleEmails,
      profilePrompt: "Secret Master CV Content DO-NOT-LOG",
      checkAlreadyProcessed: async (messageId) => seenMessageIds.has(messageId),
      extractJob: async (email) => {
        if (email.id === "msg-ai-fail") {
          throw new Error("Gemini parse error for Secret Master CV Content DO-NOT-LOG");
        }
        return {
          company_name: email.id === "msg-db-fail" ? "Epsilon" : "Delta Sdn Bhd",
          job_title: "Junior TypeScript Developer",
          job_url: email.links[0] ?? "",
          location: "Kuala Lumpur",
          salary_range: null,
          is_remote: false,
          training_signals: "Mentorship provided",
          match_score: 85,
          strengths: "TypeScript match",
          gaps_and_risks: "None",
          cv_suggestions: "Emphasize TypeScript projects",
          improvement_action_item: "Review and shortlist",
        };
      },
      insertJob: async (email) => {
        if (email.id === "msg-db-fail") {
          throw new Error("Neon connection error");
        }
        if (seenMessageIds.has(email.id)) return false;
        seenMessageIds.add(email.id);
        return true;
      },
    });

  const firstRun = await runOnce();
  assert.equal(firstRun.messagesFound, 3);
  assert.equal(firstRun.jobsCreated, 1);
  assert.equal(firstRun.duplicatesSkipped, 0);
  assert.equal(firstRun.aiExtractionFailures, 1);
  assert.equal(firstRun.databaseFailures, 1);

  const secondRun = await runOnce();
  assert.equal(secondRun.messagesFound, 3);
  assert.equal(secondRun.jobsCreated, 0);
  assert.equal(secondRun.duplicatesSkipped, 1);
});

test("getJobAlertEmails caps pagination at 5 pages even if nextPageToken continues", async () => {
  const encode = (str: string) =>
    Buffer.from(str, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  let listCalls = 0;
  const fakeFetch: typeof fetch = async (input) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    if (url === "https://oauth2.googleapis.com/token") {
      return new Response(JSON.stringify({ access_token: "tok" }), { status: 200 });
    }
    const parsed = new URL(url);
    if (parsed.pathname.endsWith("/messages")) {
      listCalls += 1;
      return new Response(
        JSON.stringify({
          messages: [{ id: `msg-${listCalls}` }],
          nextPageToken: `page-${listCalls + 1}`,
        }),
        { status: 200 }
      );
    }
    const id = parsed.pathname.split("/").pop() ?? "";
    return new Response(
      JSON.stringify({
        id,
        payload: {
          headers: [
            { name: "From", value: "noreply@e.jobstreet.com" },
            { name: "Subject", value: `Alert ${id}` },
          ],
          mimeType: "text/plain",
          body: { data: encode(`Job listing ${id}`) },
        },
      }),
      { status: 200 }
    );
  };

  const emails = await getJobAlertEmails({
    fetchImpl: fakeFetch,
    env: {
      GMAIL_CLIENT_ID: "cid",
      GMAIL_CLIENT_SECRET: "csecret",
      GMAIL_REFRESH_TOKEN: "rtoken",
    },
  });

  assert.equal(listCalls, 5);
  assert.equal(emails.length, 5);
});

