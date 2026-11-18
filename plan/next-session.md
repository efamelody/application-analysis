# Next Session Plan

## First Run Checklist

1. Read `plan/current-state.md`.
2. Confirm `neon/migrations/001_applications.sql`, `002_profile.sql`, and
   `003_job_alerts.sql` have been run in the active Neon database.
3. Confirm these server-side variables exist in local `.env` and Vercel:

```env
DATABASE_URL=...
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash-lite
EMAIL_WEBHOOK_SECRET=...
APP_URL=...
CRON_SECRET=...
APP_PASSWORD=...
AUTH_SECRET=...
EXTENSION_ACCESS_TOKEN=...
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...
GMAIL_ALLOWED_SENDERS=noreply@e.jobstreet.com,jobalerts-noreply@linkedin.com
```

4. Restart `npm run dev` after changing `.env`.
5. Open `/login`, sign in, and save the master CV at `/profile`.
6. Test the Gmail cron route locally with the `CRON_SECRET`.
7. Deploy to Vercel and test the production route.

## Immediate Development Tasks

### 1. End-to-end Gmail test

Acceptance criteria:

- A real LinkedIn alert with the `Job Alerts` label is found.
- A real JobStreet alert with the `Job Alerts` label is found.
- Both senders are accepted.
- An unrelated sender is ignored.
- A job row is created once with status `discovered`.
- Running the cron twice does not create a duplicate.

### 2. Fix extraction edge cases

Check real alert emails for:

- HTML-only bodies.
- Tracking URLs.
- Multiple job links in one email.
- Missing salary or location.
- Company names with unusual formatting.

Keep only absolute `http` and `https` listing URLs.

### 3. Finish review workflow

Add dashboard actions for:

- `discovered` → `reviewing`
- `reviewing` → `shortlisted`
- `shortlisted` → `applied`
- Reject/archive actions.

The current dashboard filters statuses but does not yet provide all status
transition buttons.

### 4. Add tests

Prioritize tests for:

- Exact Gmail sender matching.
- Gmail pagination.
- HTML body extraction.
- Invalid URL rejection.
- Duplicate cron executions.
- Session and extension-token authorization.
- Gemini response validation.

### 5. Improve extension configuration

The current token is manually embedded in `jobstreet-extension/background.js`.
Later, move `APP_URL` and the token into `chrome.storage.local` or a small
private configuration flow. Do not publish the token.

### 6. Add production observability

Record cron execution summaries without logging CVs, OAuth tokens, full email
bodies, or cover letters. Track:

- Messages found.
- Jobs created.
- Duplicates skipped.
- AI extraction failures.
- Database failures.

## Do Not Do

- Do not scrape LinkedIn or JobStreet directly.
- Do not automate application submission.
- Do not commit `.env`, OAuth credentials, refresh tokens, or extension tokens.
- Do not expose the Neon connection string to client code.
- Do not send unrelated Gmail messages to Gemini.
