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
// Ensure we use a custom Chromium path in environments like Render.
async function getBrowser() {
  if (browserInstance) return browserInstance;

  // Set the Chromium path for Render or fallback to Puppeteer's default.
  const chromiumPath = process.env.CHROMIUM_PATH || puppeteer.executablePath();  // Ensure proper path in Render or fallback to default Puppeteer path

  browserInstance = await puppeteer.launch({
    headless: "new",  // Ensure the latest headless mode (works with newer Puppeteer versions)
    executablePath: chromiumPath, // Specify the Chromium path explicitly
    args: [
      "--no-sandbox",               // Needed for environments like Render.com
      "--disable-setuid-sandbox",   // Disable setuid sandbox
      "--disable-dev-shm-usage",    // Reduce shared memory usage
      "--ignore-certificate-errors",// Ignore SSL errors
      "--window-size=1366,768",     // Standard desktop window size
      "--disable-gpu",              // Disable GPU hardware acceleration
      "--single-process",           // Ensure single-process mode in some environments
    ],
  });

  return browserInstance;
}

// ------------------ Screenshot Capture ------------------
// ------------------ Screenshot Capture (Accurate Views) ------------------
async function captureScreens(url) {
  console.log(`[SCREENSHOT] Capturing actual desktop and mobile views for ${url}`);
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

    const desktopUrl = url.replace(/\?m=\d$/, "");  // Remove ?m=<number> if present

    try {
      await desktopPage.goto(desktopUrl, {
        waitUntil: "networkidle2",  // Wait for the page to finish loading
        timeout: 60000,  // 60 seconds timeout for slower sites
      });
      await new Promise(res => setTimeout(res, 1200)); // Wait for the page to render completely
      const image = await desktopPage.screenshot({ encoding: "base64", fullPage: false });
      shots.desktop = `data:image/png;base64,${image}`;
      console.log("[SCREENSHOT] Desktop captured successfully");
    } catch (err) {
      console.warn("[SCREENSHOT] Desktop capture failed (1st attempt):", err.message);

      // Retry with a lighter loading mode
      try {
        console.log("[SCREENSHOT] Retrying desktop capture with lighter mode...");
        await desktopPage.goto(desktopUrl, {
          waitUntil: "domcontentloaded",  // Less strict loading condition
          timeout: 30000,
        });
        await new Promise(res => setTimeout(res, 800)); // Small wait
        const image = await desktopPage.screenshot({ encoding: "base64", fullPage: false });
        shots.desktop = `data:image/png;base64,${image}`;
        console.log("[SCREENSHOT] Desktop captured successfully (on retry)");
      } catch (retryErr) {
        console.warn("[SCREENSHOT] Desktop capture failed again:", retryErr.message);
      }
    } finally {
      await desktopPage.close().catch(() => {});
    }

    // --- MOBILE ---
    const mobilePage = await browser.newPage();
    await mobilePage.setViewport({
      width: 375,        // Mobile width
      height: 667,       // Mobile height
      isMobile: true,    // Set device to mobile
      deviceScaleFactor: 2,  // Retina quality
    });
    await mobilePage.setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) " +
      "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    );

    try {
      await mobilePage.goto(url, {
        waitUntil: "networkidle2",
        timeout: 60000,  // Give mobile page more time
      });
      await new Promise(res => setTimeout(res, 1200));  // Wait for page to render
      const image = await mobilePage.screenshot({ encoding: "base64", fullPage: false });
      shots.mobile = `data:image/png;base64,${image}`;
      console.log("[SCREENSHOT] Mobile captured successfully");
    } catch (err) {
      console.warn("[SCREENSHOT] Mobile capture failed (1st attempt):", err.message);

      // Retry with lighter loading
      try {
        console.log("[SCREENSHOT] Retrying mobile capture with lighter mode...");
        await mobilePage.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        await new Promise(res => setTimeout(res, 800)); // Small wait
        const image = await mobilePage.screenshot({ encoding: "base64", fullPage: false });
        shots.mobile = `data:image/png;base64,${image}`;
        console.log("[SCREENSHOT] Mobile captured successfully (on retry)");
      } catch (retryErr) {
        console.warn("[SCREENSHOT] Mobile capture failed again:", retryErr.message);
      }
    } finally {
      await mobilePage.close().catch(() => {});
    }

  } catch (err) {
    console.error("[SCREENSHOT] General capture error:", err.message);
  }

  console.log("[SCREENSHOT] Done.");
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
