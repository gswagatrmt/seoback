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

// ------------------ Memory-Optimized Puppeteer Browser ------------------
async function getBrowser() {
  if (browserInstance) return browserInstance;

  // Get the CHROMIUM_PATH environment variable
  const chromiumPath = process.env.CHROMIUM_PATH || puppeteer.executablePath();

  // Memory-optimized configuration to stay under 512MB RAM limit
  browserInstance = await puppeteer.launch({
    headless: true,
    executablePath: chromiumPath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",           // Disable shared memory
      "--disable-accelerated-2d-canvas",   // Reduce memory usage
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-features=TranslateUI",    // Disable translation
      "--disable-ipc-flooding-protection",
      "--disable-background-networking",   // Reduce background activity
      "--no-first-run",
      "--no-zygote",                       // Single process mode
      "--single-process",                  // Important for low RAM
      "--memory-pressure-off",             // Disable memory pressure handling
      "--max_old_space_size=256",          // Limit heap size to 256MB
      "--optimize-for-size",               // Optimize for memory usage
      "--disable-gpu",                     // Disable GPU acceleration
      "--disable-software-rasterizer",
      "--disable-web-security",            // Allow cross-origin for screenshots
      "--window-size=1366,768",
    ],
  });

  console.log("[BROWSER] Launched memory-optimized Puppeteer instance");
  return browserInstance;
}

// ------------------ Screenshot Capture ------------------
// ------------------ Optimized Screenshot Capture ------------------
// PSI for mobile (low RAM), Puppeteer for desktop (memory-optimized)
async function captureScreens(url, psiData) {
  console.log(`[SCREENSHOT] Capturing screenshots: PSI for mobile, Puppeteer for desktop`);
  const shots = {
    desktop: null,
    mobile: psiData?.mobile?.screenshot || null // Use PSI screenshot for mobile
  };

  if (shots.mobile) {
    console.log(`[SCREENSHOT] Using PSI mobile screenshot`);
  } else {
    console.log(`[SCREENSHOT] No PSI mobile screenshot available`);
  }

  // Only use Puppeteer for desktop (memory-optimized)
  try {
    const browser = await getBrowser();
    shots.desktop = await captureDesktopView(browser, url);
  } catch (err) {
    console.error("[SCREENSHOT] Desktop capture error:", err.message);
  }

  console.log("[SCREENSHOT] Capture complete.");
  return shots;
}

// ------------------ Memory-Optimized Desktop Screenshot Capture ------------------
async function captureDesktopView(browser, url) {
  let page = null;
  try {
    page = await browser.newPage();

    // Optimized desktop viewport configuration
    const viewport = {
      width: 1366,
      height: 768,
      deviceScaleFactor: 1, // Reduced for memory efficiency
      isMobile: false
    };

    const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

    await page.setViewport(viewport);
    await page.setUserAgent(userAgent);

    // Block resource types that consume memory
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      // Block heavy resources to save memory
      if (['image', 'media', 'font', 'stylesheet'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    console.log(`[SCREENSHOT] Loading desktop view for ${url} (memory-optimized)`);

    // Use faster loading strategy
    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",  // Faster than networkidle
        timeout: 30000
      });
    } catch (navErr) {
      if (navErr.message.includes("timeout")) {
        console.warn(`[SCREENSHOT] Navigation timeout, attempting capture anyway...`);
      } else {
        throw new Error(`Navigation failed: ${navErr.message}`);
      }
    }

    // Minimal wait time to save memory
    await new Promise(res => setTimeout(res, 800));

    // Memory-efficient screenshot settings
    const image = await page.screenshot({
      encoding: "base64",
      fullPage: false,  // Only viewport
      type: 'png',      // PNG for better compression
      quality: 80,      // Good quality but not maximum
    });

    console.log(`[SCREENSHOT] Desktop screenshot captured successfully`);
    return `data:image/png;base64,${image}`;

  } catch (err) {
    console.warn(`[SCREENSHOT] Desktop capture failed:`, err.message);
    return null;
  } finally {
    if (page) {
      try {
        await page.close();
        console.log(`[SCREENSHOT] Desktop page closed`);
      } catch (e) {
        console.warn(`[SCREENSHOT] Error closing desktop page:`, e.message);
      }
    }
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
      const perf = await performanceAudit(base);

      // Capture screenshots: PSI mobile + Puppeteer desktop
      const shots = await limit(() => captureScreens(base.finalUrl, perf.pageSpeedInsights));

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
          screenshotDesktop: shots.desktop,  // Puppeteer desktop screenshot
          screenshotMobile: shots.mobile,   // PSI mobile screenshot
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
    await browserInstance.close().catch(() => { });
    console.log("[BROWSER] Closed.");
  }
});
