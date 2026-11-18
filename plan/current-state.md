# Current State

## Goal

Find junior TypeScript full-stack jobs around Kuala Lumpur and Selangor, with
remote roles considered when they are suitable and offer training. The system
uses the user's master CV and project evidence to prepare reviewable CV
suggestions and cover letters.

## Implemented

### Database

- Supabase access was replaced with Neon using `@neondatabase/serverless`.
- Server-side database access is in `lib/db.ts`.
- Neon migrations are in `neon/migrations/`:
  - `001_applications.sql`: original applications table and status type.
  - `002_profile.sql`: singleton candidate profile and project evidence.
  - `003_job_alerts.sql`: discovery statuses and Gmail/job metadata.
- The user reported that the migrations have been run.

### CV Profile

- `/profile` stores the master CV as text.
- `/profile` stores target roles, locations, and remote preferences.
- `/profile` stores reusable project/evidence records.
- Job analysis and cover-letter prompts use this stored profile.
- Job-specific content does not overwrite the master CV.

Relevant files:

- `app/profile/page.tsx`
- `app/profile/profile-client.tsx`
- `app/api/profile/route.ts`
- `app/api/profile/evidence/route.ts`
- `lib/profile.ts`

### Gmail Job Alerts

- Gmail is queried with the `Job Alerts` label only.
- Approved senders are:
  - `noreply@e.jobstreet.com`
  - `jobalerts-noreply@linkedin.com`
- Gmail API access uses the read-only scope.
- The worker reads up to five pages of messages from the last seven days.
- Sender addresses are normalized and compared exactly.
- Gmail message IDs are stored for deduplication.
- Gemini extracts job details and evaluates them against the profile.
- Imported jobs start with status `discovered`.

Relevant files:

- `lib/gmail.ts`
- `app/api/cron/job-alerts/route.ts`
- `neon/migrations/003_job_alerts.sql`
- `docs/gmail-job-alerts.md`

### Vercel Schedule

`vercel.json` runs `/api/cron/job-alerts` daily at `01:00 UTC`, which is
`09:00` in Malaysia.

The endpoint requires:

```http
Authorization: Bearer <CRON_SECRET>
```

### Authentication

- `/login` provides a single-user password login.
- `APP_PASSWORD` is the dashboard password.
- `AUTH_SECRET` signs the HTTP-only session cookie.
- Profile and application APIs require the session.
- The JobStreet extension uses `EXTENSION_ACCESS_TOKEN` instead.
- The email status webhook requires `EMAIL_WEBHOOK_SECRET`.

Relevant files:

- `app/login/page.tsx`
- `app/api/auth/login/route.ts`
- `app/api/auth/logout/route.ts`
- `lib/auth.ts`

### JobStreet Extension

The extension manually captures a JobStreet listing and sends it to
`/api/applications/create`. It now sends `x-extension-token` and creates a
discovered job instead of incorrectly marking it as applied.

Relevant files:

- `jobstreet-extension/background.js`
- `jobstreet-extension/README.md`

The extension is intentionally a private unpacked extension because its access
token is embedded in `background.js`.

## Verification Completed

- `npm test` passes (15 unit tests covering Gmail sender matching, pagination, HTML/link extraction, URL normalization, duplicate cron runs, auth, and review workflow).
- `npm run lint` passes.
- `npm run build` passes.
- `git diff --check` passes.

## Known Runtime Notes

- The Gmail OAuth refresh token and cron behavior need a real end-to-end test against live Gmail messages.
- The user must add the same environment variables to Vercel; local `.env`
  values are not deployed automatically.
- The browser hydration warning involving `fdprocessedid` was caused by a
  browser autofill/form extension modifying the login DOM, not by the app.
- Existing Supabase data still requires a separate export/import if it has not
  already been migrated.
