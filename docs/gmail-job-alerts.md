# Gmail Job Alerts

The application reads only Gmail messages with the `Job Alerts` label. It does
not use a Gmail password and it does not read the rest of the inbox. The Gmail
OAuth grant uses the read-only scope:

```text
https://www.googleapis.com/auth/gmail.readonly
```

The Gmail API supports the same style of label and sender queries as Gmail
search. The scheduled worker uses:

```text
label:"Job Alerts" newer_than:7d {from:noreply@e.jobstreet.com from:jobalerts-noreply@linkedin.com}
```

Sources:

- Gmail filtering: https://developers.google.com/workspace/gmail/api/guides/filtering
- List messages: https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list
- Get messages: https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/get
- Google OAuth for web servers: https://developers.google.com/identity/protocols/oauth2/web-server

## 1. Gmail Filter

Create a Gmail filter for:

```text
{from:(noreply@e.jobstreet.com) from:(jobalerts-noreply@linkedin.com)}
```

Apply a label named exactly:

```text
Job Alerts
```

The application depends on that label name.

## 2. Enable The Gmail API

1. Open the Google Cloud Console.
2. Create or select a project.
3. Enable **Gmail API** in **APIs & Services → Library**.
4. Configure the OAuth consent screen.
5. If the app is in testing mode, add your Gmail address as a test user.
6. Create an OAuth client ID for a web application.
7. Keep the client ID and secret private.

Google's OAuth documentation recommends using an OAuth client library and
keeping client secrets outside the source tree. This project stores the values
only as server-side environment variables.

## 3. Get A Refresh Token

The app needs a refresh token so the daily Vercel job can obtain short-lived
access tokens without asking you to sign in every day.

Use an OAuth flow or OAuth Playground with your own OAuth client credentials and
request only:

```text
https://www.googleapis.com/auth/gmail.readonly
```

Grant access to the Gmail account containing the `Job Alerts` label, exchange
the authorization code for tokens, and copy the returned refresh token. Never
commit it to Git or paste it into frontend code.

If Google returns no refresh token, revoke the previous grant and authorize
again with offline access and consent requested.

## 4. Environment Variables

Add these to `.env.local` for local testing and to Vercel for the Production
environment:

```env
GMAIL_CLIENT_ID=your-google-oauth-client-id
GMAIL_CLIENT_SECRET=your-google-oauth-client-secret
GMAIL_REFRESH_TOKEN=your-gmail-refresh-token
GMAIL_ALLOWED_SENDERS=noreply@e.jobstreet.com,jobalerts-noreply@linkedin.com
CRON_SECRET=your-long-random-secret
```

`GMAIL_ALLOWED_SENDERS` is a second application-level allowlist. Even if a
message has the correct Gmail label, the worker ignores it unless its sender
contains one of the approved addresses.

## 5. Database Migration

Run this migration after the existing profile migration:

```text
neon/migrations/003_job_alerts.sql
```

It adds job-discovery statuses and stores the source message ID so the same
alert is never imported twice.

## 6. Test Locally

Start the app, then invoke the protected endpoint with the cron secret:

```bash
curl -H "Authorization: Bearer your-long-random-secret" \
  http://localhost:3000/api/cron/job-alerts
```

The response reports how many emails were read, created, skipped, and failed.

## 7. Vercel Schedule

`vercel.json` runs the job at `01:00 UTC`, which is `09:00` in Malaysia. Vercel
cron expressions use UTC for this project. Add all Gmail, Neon, Gemini, and cron
variables to Vercel, then redeploy.

The route is protected by `CRON_SECRET`; it must not be made public without
authentication.

## Dashboard Authentication

The dashboard and profile API use a single-user password session. Set these
additional Vercel variables:

```env
APP_PASSWORD=your-long-private-password
AUTH_SECRET=another-long-random-secret
```

Open the deployed app and sign in with `APP_PASSWORD`. The application stores
only an HTTP-only session cookie; it does not store your Google password.

If you use the private JobStreet extension, set `EXTENSION_ACCESS_TOKEN` in
Vercel and the same value in your local `jobstreet-extension/background.js`.
Do not publish that extension or commit the token.

## Data Flow

```text
Gmail filter
  -> Job Alerts label
  -> daily Vercel cron
  -> Gmail read-only API
  -> sender validation
  -> Gemini extraction and CV matching
  -> Neon application row with status `discovered`
  -> dashboard review
```

The app prepares recommendations and drafts only. You still open the original
listing, review the CV suggestions, edit the cover letter, and submit the
application yourself.
