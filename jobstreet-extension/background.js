// JobTracker Scraper — MV3 background service worker
// Set your deployed app URL here (or via chrome.storage in future versions).
const APP_URL = "https://your-app.vercel.app";

function showToast(tabId, message, isError = false) {
  chrome.scripting.executeScript({
    target: { tabId },
    func: (msg, err) => {
      const el = document.createElement("div");
      el.textContent = msg;
      el.style.cssText = `position:fixed;top:16px;right:16px;z-index:999999;padding:12px 16px;border-radius:8px;font-size:14px;font-family:sans-serif;color:#fff;background:${err ? "#dc2626" : "#16a34a"};box-shadow:0 4px 12px rgba(0,0,0,.25);`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 4000);
    },
    args: [message, isError],
  });
}

function scrapeJobStreetPage() {
  const pick = (selectors) => {
    for (const s of selectors) {
      const el = document.querySelector(s);
      const t = el?.innerText?.trim();
      if (t) return t;
    }
    return "";
  };

  return {
    job_title:
      pick(['h1[data-automation="job-detail-title"]', "h1"]) || document.title,
    company_name: pick([
      'span[data-automation="advertiser-name"]',
      '[data-automation="job-card-company"]',
      '[data-automation="job-detail-company"]',
      'a[data-automation="job-detail-company"]',
    ]),
    salary_range:
      pick([
        'span[data-automation="job-detail-salary"]',
        '[data-automation="job-detail-salary"]',
      ]) || "Not specified",
    job_description:
      pick([
        'div[data-automation="jobDescription"]',
        'div[data-automation="job-detail-description"]',
        '[data-automation="jobAdDetails"]',
      ]) || document.body.innerText.slice(0, 6000),
    job_url: window.location.href,
  };
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url || !tab.url.includes("jobstreet.com")) {
    if (tab.id) showToast(tab.id, "Open a JobStreet listing first.", true);
    return;
  }

  let results;
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrapeJobStreetPage,
    });
  } catch (err) {
    console.error("Scrape failed:", err);
    showToast(tab.id, "Scrape failed on this page.", true);
    return;
  }

  const payload = results?.[0]?.result;
  if (!payload?.job_title || !payload?.company_name) {
    showToast(tab.id, "Could not find job title/company on this page.", true);
    return;
  }

  try {
    const response = await fetch(`${APP_URL}/api/applications/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await response.json().catch(() => ({}));
    if (response.ok && json.success) {
      showToast(tab.id, "Application saved & Gap Analysis generated!");
    } else if (response.status === 409) {
      showToast(tab.id, "Already tracked — see your dashboard.", true);
    } else {
      showToast(tab.id, `Save failed: ${json.error || response.status}`, true);
    }
  } catch (err) {
    console.error("Tracker API Error:", err);
    showToast(tab.id, "Tracker API unreachable. Check APP_URL.", true);
  }
});
