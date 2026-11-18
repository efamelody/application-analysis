# JobTracker Scraper (Chrome Extension)

Lives in this monorepo at `jobstreet-extension/`. The rest of the repo is ignored by Chrome.

## What It Does

The extension captures the JobStreet listing currently open in your browser
and sends it to the deployed tracker. The job is stored as `discovered`, then
Gemini analyzes it against your CV profile. It does not apply for jobs.

## Dev Setup

1. Deploy the Next.js app, or run `npm run dev` and expose it through a secure tunnel.
2. In `background.js`, set `APP_URL` to the app URL.
3. In Vercel, set `EXTENSION_ACCESS_TOKEN` to a long random value.
4. Put the same value in the local `background.js` as `EXTENSION_ACCESS_TOKEN`.
5. Open `chrome://extensions/`.
6. Enable **Developer mode**.
7. Select **Load unpacked** and choose this folder.
8. Open a `jobstreet.com*` job listing.
9. Click the extension icon.
10. Confirm the success toast, then review the job in the dashboard.

The extension request is:

```http
POST /api/applications/create
x-extension-token: <EXTENSION_ACCESS_TOKEN>
```

Keep this unpacked extension private because the token is embedded in it. Do
not publish it in the Chrome Web Store or commit a real token to Git.

## Notes

- Selectors use a fallback chain (`data-automation` attrs change often); last resort is `document.body.innerText`.
- Duplicate URLs return `409 Already tracked`.
- The extension only works for JobStreet pages, not LinkedIn pages.
- To change the API target without editing code later, move `APP_URL` into `chrome.storage.local`.
- If the API returns `401`, check `EXTENSION_ACCESS_TOKEN` in both Vercel and `background.js`.
- If the API returns `503`, check Neon migrations and `DATABASE_URL`.
