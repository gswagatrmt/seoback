import { fetchPage } from "./fetchPage.js";
import { onpage } from "./onpage.js";
import { performanceAudit } from "./performance.js";
import { usability } from "./usability.js";
import { social } from "./social.js";
import { localSeo } from "./local.js";
import { tech } from "./tech.js";
import { gradeAll } from "./graders.js";
import puppeteer from "puppeteer";
import pLimit from 'p-limit'; // For limiting concurrency

let browserInstance = null;

// Map to track URLs that are being processed and their ongoing audit promises
const inProgress = new Map();

// Limit concurrency to 5 concurrent tasks (adjust as needed)
const limit = pLimit(5);

// ------------------ Reusable Puppeteer Browser ------------------
async function getBrowser() {
  if (browserInstance) return browserInstance;

  // Get the CHROMIUM_PATH environment variable
  const chromiumPath = process.env.CHROMIUM_PATH || puppeteer.executablePath();

  browserInstance = await puppeteer.launch({
    headless: true,
    executablePath: chromiumPath,  // Path to Chromium
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--ignore-certificate-errors",
      "--window-size=1366,768",
    ],
  });

  return browserInstance;
}

// ------------------ Screenshot Capture ------------------
async function captureScreens(url) {
  console.log(`[SCREENSHOT] Capturing actual desktop and mobile views for ${url}`);
  const shots = { desktop: null, mobile: null };

  try {
    const browser = await getBrowser();
    const page = await browser.newPage();  // Reuse the same page for both captures

    // Capture desktop view
    shots.desktop = await captureDeviceView(page, url, false);  // false = desktop

    // Capture mobile view
    shots.mobile = await captureDeviceView(page, url, true);   // true = mobile

    await page.close();
  } catch (err) {
    console.error("[SCREENSHOT] General capture error:", err.message);
  }

  console.log("[SCREENSHOT] Done.");
  return shots;
}

// ------------------ Capture Device View (Desktop/Mobile) ------------------
async function captureDeviceView(page, url, isMobile) {
  const viewport = isMobile
    ? { width: 375, height: 667, isMobile: true, deviceScaleFactor: 2 }
    : { width: 1366, height: 768 };

  const userAgent = isMobile
    ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) " +
      "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

  await page.setViewport(viewport);
  await page.setUserAgent(userAgent);

  // Ensure page has loaded before taking a screenshot
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });

    // Wait for the page to settle and only capture the topmost view (current viewport)
    await new Promise(res => setTimeout(res, 1200));

    const image = await page.screenshot({
      encoding: "base64",
      fullPage: false, // Capture only the viewport area
    });

    return `data:image/png;base64,${image}`;
  } catch (err) {
    console.warn(`[SCREENSHOT] Capture failed for ${isMobile ? "mobile" : "desktop"} view:`, err.message);
    return null;
  }
}

// ------------------ Main Audit ------------------
export async function auditSite(url) {
  // Check if the URL is already being processed
  if (inProgress.has(url)) {
    console.log(`[AUDIT] Returning ongoing audit result for: ${url}`);
    // Wait for the ongoing audit to finish and return the result
    const auditResult = await inProgress.get(url);
    return auditResult;
  }

  // Start a new audit process for the URL
  console.log(`[AUDIT] Starting audit for: ${url}`);
  console.time(`[AUDIT] ${url}`);

  // Use a promise to store the audit result
  const auditPromise = (async () => {
    try {
      const base = await fetchPage(url);

      // Run lightweight modules first (fast & parallel)
      const [on, soc, loc, tec] = await Promise.all([
        onpage(base),
        social(base),
        localSeo(base),
        tech(base),
      ]);

      // Run heavy tasks (PSI + screenshots) in parallel with concurrency control
      const [perf, shots] = await Promise.all([
        performanceAudit(base),
        limit(() => captureScreens(base.finalUrl)),  // Control concurrency with p-limit
      ]);

      // Combine all results
      const sections = {
        onpage: on,
        performance: perf,
        social: soc,
        local: loc,
        tech: tec,
      };

      const grades = gradeAll(sections);

      const result = {
        meta: {
          url: base.finalUrl,
          fetchedAt: new Date().toISOString(),
          timing: base.timing,
          screenshotDesktop: shots.desktop,
          screenshotMobile: shots.mobile,
        },
        sections,
        grades,
        summary: {
          letter: grades.overall.letter,
          radar: {
            onpage: grades.onpage.score,
            performance: grades.performance.score,
            social: grades.social.score,
            techlocal: grades.techlocal.score,
          },
        },
      };

      console.timeEnd(`[AUDIT] ${url}`);
      console.log(`[AUDIT] Completed successfully for: ${url}`);

      return result;
    } finally {
      // After audit completion, remove the URL from the set
      inProgress.delete(url);
    }
  })();

  // Store the ongoing audit in progress
  inProgress.set(url, auditPromise);

  // Return the ongoing promise so that both requests will resolve with the same result
  return auditPromise;
}

// ------------------ Graceful Shutdown ------------------
process.on("exit", async () => {
  if (browserInstance) {
    await browserInstance.close().catch(() => {});
    console.log("[BROWSER] Closed.");
  }
});
