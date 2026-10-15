# JobTracker Scraper (Chrome Extension)

Lives in this monorepo at `jobstreet-extension/`. The rest of the repo is ignored by Chrome.

## Dev setup

1. Deploy the Next.js app (or run `npm run dev` + expose via tunnel).
2. Edit `background.js` → set `APP_URL` to your app URL.
3. Open `chrome://extensions/` → enable **Developer mode** → **Load unpacked** → select the `jobstreet-extension/` folder.
4. Open any `jobstreet.com*` job listing → click the extension icon → toast confirms save.

## Notes

- Selectors use a fallback chain (`data-automation` attrs change often); last resort is `document.body.innerText`.
- Duplicate URLs return `409 Already tracked`.
- To change the API target without editing code later, consider moving `APP_URL` into `chrome.storage.sync`.
