import { fetchPage } from "./fetchPage.js";
import { onpage } from "./onpage.js";
import { performanceAudit } from "./performance.js";
import { usability } from "./usability.js";
import { social } from "./social.js";
import { localSeo } from "./local.js";
import { tech } from "./tech.js";
import { gradeAll } from "./graders.js";
import puppeteer from "puppeteer";

let browserInstance = null;

// Map to track URLs that are being processed and their ongoing audit promises
const inProgress = new Map();

// Queues for desktop and mobile screenshot captures
const captureQueue = {
  desktop: Promise.resolve(),  // Start with an empty resolved promise
  mobile: Promise.resolve(),   // Start with an empty resolved promise
};

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

    // Ensure desktop and mobile captures are processed sequentially using queues
    await captureQueue.desktop;
    captureQueue.desktop = captureDesktop(browser, url, shots);

    await captureQueue.mobile;
    captureQueue.mobile = captureMobile(browser, url, shots);

    // Wait until both captures are complete
    await Promise.all([captureQueue.desktop, captureQueue.mobile]);

  } catch (err) {
    console.error("[SCREENSHOT] General capture error:", err.message);
  }

  console.log("[SCREENSHOT] Done.");
  return shots;
}

// ------------------ Desktop Capture ------------------
async function captureDesktop(browser, url, shots) {
  console.log("[SCREENSHOT] Capturing desktop...");
  const desktopPage = await browser.newPage();
  await desktopPage.setViewport({ width: 1366, height: 768 });
  await desktopPage.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
  );

  const desktopUrl = url.replace(/\?m=\d$/, "");

  try {
    await desktopPage.goto(desktopUrl, {
      waitUntil: "networkidle2",
      timeout: 45000,  // 45s for slower sites
    });

    await new Promise(res => setTimeout(res, 1200)); // allow render
    const image = await desktopPage.screenshot({
      encoding: "base64",
      fullPage: false,
    });
    shots.desktop = `data:image/png;base64,${image}`;
    console.log("[SCREENSHOT] Desktop captured successfully");
  } catch (err) {
    console.warn("[SCREENSHOT] Desktop capture failed (1st attempt):", err.message);

    // Retry with lighter loading mode
    try {
      console.log("[SCREENSHOT] Retrying desktop capture with lighter mode...");
      await desktopPage.goto(desktopUrl, {
        waitUntil: "domcontentloaded", // less strict
        timeout: 30000,
      });
      await new Promise(res => setTimeout(res, 800)); // small wait
      const image = await desktopPage.screenshot({
        encoding: "base64",
        fullPage: false,
      });
      shots.desktop = `data:image/png;base64,${image}`;
      console.log("[SCREENSHOT] Desktop captured successfully (on retry)");
    } catch (retryErr) {
      console.warn("[SCREENSHOT] Desktop capture failed again:", retryErr.message);
    }
  } finally {
    await desktopPage.close().catch(() => {});
  }
}

// ------------------ Mobile Capture ------------------
async function captureMobile(browser, url, shots) {
  console.log("[SCREENSHOT] Capturing mobile...");
  const mobilePage = await browser.newPage();
  await mobilePage.setViewport({
    width: 375,
    height: 667,
    isMobile: true,
    deviceScaleFactor: 2,
  });
  await mobilePage.setUserAgent(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) " +
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
  );

  const mobileUrl = url;

  try {
    await mobilePage.goto(mobileUrl, {
      waitUntil: "networkidle2",
      timeout: 45000, // give mobile a little more time
    });

    await new Promise(res => setTimeout(res, 1200));
    const image = await mobilePage.screenshot({
      encoding: "base64",
      fullPage: false,
    });
    shots.mobile = `data:image/png;base64,${image}`;
    console.log("[SCREENSHOT] Mobile captured successfully");
  } catch (err) {
    console.warn("[SCREENSHOT] Mobile capture failed (1st attempt):", err.message);

    // Retry with lighter DOM-only load
    try {
      console.log("[SCREENSHOT] Retrying mobile capture with lighter mode...");
      await mobilePage.goto(mobileUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await new Promise(res => setTimeout(res, 800));
      const image = await mobilePage.screenshot({
        encoding: "base64",
        fullPage: false,
      });
      shots.mobile = `data:image/png;base64,${image}`;
      console.log("[SCREENSHOT] Mobile captured successfully (on retry)");
    } catch (retryErr) {
      console.warn("[SCREENSHOT] Mobile capture failed again:", retryErr.message);
    }
  } finally {
    await mobilePage.close().catch(() => {});
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

      // 1️⃣ Run lightweight modules first (fast & parallel)
      const [on, soc, loc, tec] = await Promise.all([
        onpage(base),
        social(base),
        localSeo(base),
        tech(base),
      ]);

      // 2️⃣ Run heavy tasks (PSI + screenshots) in parallel
      const [perf, shots] = await Promise.all([
        performanceAudit(base),
        captureScreens(base.finalUrl),
      ]);

      // 3️⃣ Combine all results
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
