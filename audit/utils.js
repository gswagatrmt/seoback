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

// Limit concurrency to 1 concurrent task to save memory on 512MB instances
const limit = pLimit(1);

// ------------------ Memory-Optimized Puppeteer Browser (Under 512MB RAM) ------------------
async function getBrowser() {
  if (browserInstance) {
    console.log("[BROWSER] Reusing existing browser instance");
    return browserInstance;
  }

  // Get the CHROMIUM_PATH environment variable
  const chromiumPath = process.env.CHROMIUM_PATH || puppeteer.executablePath();

  console.log("[BROWSER] Launching new memory-optimized Puppeteer instance");

  browserInstance = await puppeteer.launch({
    headless: true,
    protocolTimeout: 120000, // Increase protocol timeout to 2 minutes
    executablePath: chromiumPath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",           // Critical for low RAM usage
      "--disable-accelerated-2d-canvas",   // Reduce memory usage
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-features=TranslateUI",    // Disable translation features
      "--disable-ipc-flooding-protection",
      "--disable-background-networking",   // Reduce background activity
      "--no-first-run",
      "--no-zygote",                       // Single process mode for low RAM
      "--single-process",                  // IMPORTANT: Single process to save RAM
      "--memory-pressure-off",             // Disable memory pressure handling
      "--max_old_space_size=200",          // Limit heap size to 200MB (safe under 512MB limit)
      "--optimize-for-size",               // Optimize for memory usage
      "--disable-gpu",                     // Disable GPU acceleration
      "--disable-software-rasterizer",
      "--disable-web-security",            // Allow cross-origin for screenshots
      "--disable-extensions",              // Disable extensions
      "--ignore-certificate-errors",
      "--window-size=1366,768",
    ],
  });

  console.log("[BROWSER] Memory-optimized browser launched successfully");
  return browserInstance;
}

// ------------------ Screenshot Capture ------------------
// ------------------ Hybrid Screenshot Capture ------------------
// PSI for mobile (fast, low RAM), Puppeteer for desktop (high quality, memory-optimized)
async function captureScreens(url, psiData) {
  console.log(`[SCREENSHOT] Capturing screenshots: PSI mobile + Puppeteer desktop for ${url}`);

  // Start with PSI mobile screenshot (if available)
  const shots = {
    desktop: null,
    mobile: psiData?.mobile?.screenshot || null
  };

  if (shots.mobile) {
    console.log(`[SCREENSHOT] Using PSI mobile screenshot from performance audit`);
  } else {
    console.log(`[SCREENSHOT] No PSI mobile screenshot available, will capture with Puppeteer`);
  }

  // Capture desktop screenshot with memory-optimized Puppeteer
  try {
    console.log(`[SCREENSHOT] Launching memory-optimized Puppeteer for desktop screenshot`);
    const browser = await getBrowser();
    shots.desktop = await captureDeviceView(browser, url, false);  // false = desktop
    console.log(`[SCREENSHOT] Desktop screenshot captured successfully`);
  } catch (err) {
    console.error("[SCREENSHOT] Desktop capture error:", err.message);
    console.log("[SCREENSHOT] Continuing without desktop screenshot");
  }

  // If mobile screenshot not available from PSI, capture with Puppeteer as fallback
  if (!shots.mobile) {
    try {
      console.log(`[SCREENSHOT] Capturing mobile screenshot with Puppeteer (PSI fallback)`);
      const browser = await getBrowser();
      shots.mobile = await captureDeviceView(browser, url, true);   // true = mobile
      console.log(`[SCREENSHOT] Mobile screenshot captured successfully`);
    } catch (err) {
      console.error("[SCREENSHOT] Mobile capture error:", err.message);
      console.log("[SCREENSHOT] Continuing without mobile screenshot");
    }
  }

  console.log(`[SCREENSHOT] Capture complete - Desktop: ${shots.desktop ? '✓' : '✗'}, Mobile: ${shots.mobile ? '✓' : '✗'}`);
  return shots;
}

// ------------------ Memory-Optimized Device Screenshot Capture ------------------
async function captureDeviceView(browser, url, isMobile) {
  let page = null;
  try {
    console.log(`[SCREENSHOT] Creating new page for ${isMobile ? "mobile" : "desktop"} screenshot`);
    page = await browser.newPage();

    const viewport = isMobile
      ? { width: 375, height: 667, isMobile: true, deviceScaleFactor: 2 }
      : { width: 1366, height: 768, deviceScaleFactor: 1 }; // Reduced scale for memory

    const userAgent = isMobile
      ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) " +
      "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
      : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

    console.log(`[SCREENSHOT] Setting ${isMobile ? "mobile" : "desktop"} viewport and user agent`);
    await page.setViewport(viewport);
    await page.setUserAgent(userAgent);

    // Memory optimization: Block resource-heavy content for screenshots
    if (!isMobile) { // Only for desktop to save memory
      console.log(`[SCREENSHOT] Setting up resource blocking for memory optimization`);
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const resourceType = request.resourceType();
        // Block memory-intensive resources but allow essential ones
        if (['image', 'media', 'font'].includes(resourceType)) {
          console.log(`[SCREENSHOT] Blocking ${resourceType} resource to save memory`);
          request.abort();
        } else {
          request.continue();
        }
      });
    }

    console.log(`[SCREENSHOT] Navigating to ${url} for ${isMobile ? "mobile" : "desktop"} screenshot`);

    // Ensure page has loaded before taking a screenshot
    try {
      // Try network idle first for better content loading
      await page.goto(url, { waitUntil: "networkidle0", timeout: 20000 });
      console.log(`[SCREENSHOT] Page loaded successfully with networkidle0`);
    } catch (navErr) {
      console.warn(`[SCREENSHOT] ${isMobile ? "Mobile" : "Desktop"} navigation timeout (networkidle0), retrying with domcontentloaded...`);
      // Fallback to domcontentloaded if networkidle times out
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
        console.log(`[SCREENSHOT] Page loaded with domcontentloaded fallback`);
      } catch (retryErr) {
        // If it's just a timeout, we can still try to capture what's on the screen
        if (retryErr.message.includes("timeout") || retryErr.message.includes("Timeout")) {
          console.warn(`[SCREENSHOT] ${isMobile ? "Mobile" : "Desktop"} navigation timeout (domcontentloaded). Attempting capture anyway...`);
        } else {
          console.error(`[SCREENSHOT] Navigation failed: ${retryErr.message}`);
          throw new Error(`Navigation failed: ${retryErr.message}`);
        }
      }
    }

    // Wait for the page to settle - shorter wait for memory efficiency
    console.log(`[SCREENSHOT] Waiting for page to settle before screenshot`);
    await new Promise(res => setTimeout(res, isMobile ? 800 : 1000)); // Shorter for mobile

    console.log(`[SCREENSHOT] Taking ${isMobile ? "mobile" : "desktop"} screenshot`);
    const image = await page.screenshot({
      encoding: "base64",
      fullPage: false, // Capture only the viewport area
      type: 'png',
      quality: 85, // Good quality but memory-efficient
      timeout: 30000, // Reasonable timeout
    });

    console.log(`[SCREENSHOT] ${isMobile ? "Mobile" : "Desktop"} screenshot captured successfully (${image.length} bytes)`);
    return `data:image/png;base64,${image}`;

  } catch (err) {
    console.error(`[SCREENSHOT] Capture failed for ${isMobile ? "mobile" : "desktop"} view:`, err.message);
    console.log(`[SCREENSHOT] Continuing with null screenshot for ${isMobile ? "mobile" : "desktop"}`);
    return null;
  } finally {
    if (page) {
      console.log(`[SCREENSHOT] Closing ${isMobile ? "mobile" : "desktop"} page`);
      await page.close().catch((err) => {
        console.error(`[SCREENSHOT] Error closing page:`, err.message);
      });
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

      // Capture screenshots: PSI mobile + Puppeteer desktop (memory-optimized)
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
          screenshotDesktop: shots.desktop,  // Puppeteer desktop screenshot (memory-optimized)
          screenshotMobile: shots.mobile,   // PSI mobile screenshot (fast, low RAM)
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
      console.log(`[AUDIT] Screenshots captured - Desktop: ${shots.desktop ? '✓ Available' : '✗ Missing'}, Mobile: ${shots.mobile ? '✓ Available' : '✗ Missing'}`);

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
