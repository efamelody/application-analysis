# Job Application Tracker

A private, human-reviewed workspace for storing your master CV, project
evidence, job-fit analysis, cover-letter drafts, and application history. It
does not submit applications automatically.

## Quick Start

1. Create `.env` or `.env.local` from `.env.local.example`.
2. Set the Neon, Gemini, authentication, and Gmail variables.
3. Run the Neon migrations in this order:

```text
neon/migrations/001_applications.sql
neon/migrations/002_profile.sql
neon/migrations/003_job_alerts.sql
```

4. Start the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

The first page is `/login`. Use `APP_PASSWORD` to sign in, then use `/profile`
to save the master CV and project evidence.

## Environment

The template documents all required variables. Important groups are:

- `DATABASE_URL`: Neon pooled connection string.
- `GEMINI_API_KEY` and `GEMINI_MODEL`: AI analysis.
- `APP_PASSWORD` and `AUTH_SECRET`: dashboard login.
- `CRON_SECRET`: Vercel scheduled endpoint.
- `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, and `GMAIL_REFRESH_TOKEN`: read-only Gmail access.
- `EXTENSION_ACCESS_TOKEN`: private JobStreet extension access.
- `EMAIL_WEBHOOK_SECRET`: application-status email webhook.

Never commit `.env` or `.env.local`. If migrating from Supabase, export the
existing `applications` rows before switching `DATABASE_URL` to Neon.

Open `/profile` to store your complete master CV, search preferences, and
reusable project evidence. Job-specific CV suggestions and cover letters are
drafts and never overwrite the master CV.

To connect the Gmail `Job Alerts` label, follow
[`docs/gmail-job-alerts.md`](docs/gmail-job-alerts.md). The daily Vercel job
reads only that label and the approved LinkedIn/JobStreet senders.

## How The Automation Works

```text
Gmail filter
  -> Job Alerts label
  -> daily Vercel cron at 09:00 Malaysia time
  -> Gmail read-only API
  -> sender validation
  -> Gemini job extraction and CV matching
  -> Neon row with status discovered
  -> dashboard review
```

The system prepares CV suggestions and cover-letter drafts. It never submits an
application automatically.

## JobStreet Extension

The extension is for manually saving a JobStreet listing that you are viewing.
It does not crawl JobStreet in the background.

Follow [`jobstreet-extension/README.md`](jobstreet-extension/README.md) to:

1. Set `APP_URL`.
2. Set the same private `EXTENSION_ACCESS_TOKEN` as Vercel.
3. Load the folder as an unpacked Chrome extension.
4. Open a JobStreet listing and click the extension icon.

Keep the unpacked extension private because its access token is embedded in
`background.js`.

## Project Handoff

The next-session implementation notes are in [`plan/`](plan/):

- [`plan/current-state.md`](plan/current-state.md): implemented architecture and known runtime notes.
- [`plan/next-session.md`](plan/next-session.md): ordered testing and development tasks.
- [`docs/gmail-job-alerts.md`](docs/gmail-job-alerts.md): Google Cloud, OAuth, Gmail, and Vercel setup.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm test` | Run automated unit tests |
| `npm run lint` | Run ESLint |
| `npm run build` | Create a production build |

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
