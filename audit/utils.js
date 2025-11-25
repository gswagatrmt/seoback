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
// ------------------ Screenshot Capture (Accurate Views) ------------------
async function captureScreens(url) {
  console.log(`[SCREENSHOT] Capturing desktop and mobile views for ${url}`);
  const shots = { desktop: null, mobile: null };

  try {
    const browser = await getBrowser();

    // --- DESKTOP ---
    const desktopPage = await browser.newPage();
    await desktopPage.setViewport({ width: 1366, height: 768 });
    await desktopPage.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
    );

    const retryTimeouts = [45000, 60000, 90000]; // Retry with different timeouts
    let desktopImage = null;
    for (const timeout of retryTimeouts) {
      try {
        await desktopPage.goto(url, { waitUntil: "networkidle2", timeout });
        await new Promise(res => setTimeout(res, 1200));  // Allow render time
        desktopImage = await desktopPage.screenshot({ encoding: "base64", fullPage: true });
        shots.desktop = `data:image/png;base64,${desktopImage}`;
        console.log("[SCREENSHOT] Desktop capture successful");
        break;  // Exit retry loop if successful
      } catch (err) {
        console.warn(`[SCREENSHOT] Desktop capture failed (timeout ${timeout} ms):`, err.message);
        if (timeout === retryTimeouts[retryTimeouts.length - 1]) {
          throw err;  // Rethrow error if all retries fail
        }
      }
    }

    // --- MOBILE ---
    const mobilePage = await browser.newPage();
    await mobilePage.setViewport({ width: 375, height: 667, isMobile: true, deviceScaleFactor: 2 });
    await mobilePage.setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) " +
      "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    );

    try {
      await mobilePage.goto(url, { waitUntil: "networkidle2", timeout: 45000 });
      await new Promise(res => setTimeout(res, 1200));  // Allow render time
      const mobileImage = await mobilePage.screenshot({ encoding: "base64", fullPage: true });
      shots.mobile = `data:image/png;base64,${mobileImage}`;
      console.log("[SCREENSHOT] Mobile capture successful");
    } catch (err) {
      console.warn("[SCREENSHOT] Mobile capture failed (retrying):", err.message);
      try {
        await mobilePage.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        await new Promise(res => setTimeout(res, 800));  // Small wait
        const retryMobileImage = await mobilePage.screenshot({ encoding: "base64", fullPage: true });
        shots.mobile = `data:image/png;base64,${retryMobileImage}`;
        console.log("[SCREENSHOT] Mobile capture successful (after retry)");
      } catch (retryErr) {
        console.warn("[SCREENSHOT] Mobile capture failed again:", retryErr.message);
      }
    } finally {
      await mobilePage.close().catch(() => {});
    }
  } catch (err) {
    console.error("[SCREENSHOT] General capture error:", err.message);
  }

  console.log("[SCREENSHOT] Screenshot capture completed.");
  return shots;
}



// ------------------ Main Audit ------------------
export async function auditSite(url) {
  console.log(`[AUDIT] Starting audit for: ${url}`);
  console.time(`[AUDIT] ${url}`);

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
}

// ------------------ Graceful Shutdown ------------------
process.on("exit", async () => {
  if (browserInstance) {
    await browserInstance.close().catch(() => {});
    console.log("[BROWSER] Closed.");
  }
});
