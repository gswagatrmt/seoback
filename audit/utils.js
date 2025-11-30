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
// ------------------ Hybrid Screenshot Capture with Fallback ------------------
// PSI for mobile (fast, low RAM), Puppeteer for desktop (high quality) with PSI fallback
async function captureScreens(url, psiData) {
  console.log(`[SCREENSHOT] Capturing screenshots: PSI mobile + Puppeteer desktop (with PSI fallback) for ${url}`);

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

    // Validate Puppeteer screenshot quality
    if (shots.desktop) {
      console.log(`[SCREENSHOT] Desktop screenshot captured successfully`);
    } else {
      console.warn(`[SCREENSHOT] Puppeteer returned null/empty desktop screenshot`);
    }
  } catch (err) {
    console.error("[SCREENSHOT] Desktop capture error:", err.message);
    shots.desktop = null;
  }

  // Fallback to PSI desktop screenshot if Puppeteer failed
  if (!shots.desktop && psiData?.desktop?.screenshot) {
    console.log(`[SCREENSHOT] Puppeteer failed, falling back to PSI desktop screenshot (lower quality but better than none)`);
    shots.desktop = psiData.desktop.screenshot;
    console.log(`[SCREENSHOT] PSI desktop fallback applied successfully`);
  } else if (!shots.desktop) {
    console.log(`[SCREENSHOT] No desktop screenshot available (both Puppeteer and PSI failed)`);
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

  // Log final status with fallback information
  const desktopSource = shots.desktop ?
    (psiData?.desktop?.screenshot === shots.desktop ? 'PSI fallback' : 'Puppeteer') : 'None';
  const mobileSource = shots.mobile ? 'PSI' : 'None';

  console.log(`[SCREENSHOT] Capture complete - Desktop: ${shots.desktop ? '✓ Available' : '✗ Missing'} (${desktopSource}), Mobile: ${shots.mobile ? '✓ Available' : '✗ Missing'} (${mobileSource})`);

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

    // Selective resource blocking for authentic desktop screenshots
    if (!isMobile) { // Only for desktop screenshots
      console.log(`[SCREENSHOT] Setting up complete resource loading - allowing fonts/images/videos for authentic desktop view`);
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const resourceType = request.resourceType();
        // Allow all resources for most authentic desktop screenshot (including videos)
        // Note: This may increase RAM usage but provides the most accurate representation
        request.continue();
      });
    }

    console.log(`[SCREENSHOT] Navigating to ${url} for ${isMobile ? "mobile" : "desktop"} screenshot`);

    // Enhanced navigation strategy for heavy sites
    let navigationSuccess = false;

    try {
      // Try network idle first with longer timeout for heavy sites
      await page.goto(url, { waitUntil: "networkidle0", timeout: 45000 });
      console.log(`[SCREENSHOT] Page loaded successfully with networkidle0`);
      navigationSuccess = true;
    } catch (navErr) {
      console.warn(`[SCREENSHOT] ${isMobile ? "Mobile" : "Desktop"} navigation timeout (networkidle0), trying domcontentloaded...`);

      try {
        // Fallback to domcontentloaded with longer timeout
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        console.log(`[SCREENSHOT] Page loaded with domcontentloaded fallback`);
        navigationSuccess = true;
      } catch (retryErr) {
        if (retryErr.message.includes("timeout") || retryErr.message.includes("Timeout")) {
          console.warn(`[SCREENSHOT] ${isMobile ? "Mobile" : "Desktop"} navigation timeout (domcontentloaded). Attempting capture anyway...`);
          navigationSuccess = false; // Page might not be fully loaded
        } else {
          console.error(`[SCREENSHOT] Navigation failed: ${retryErr.message}`);
          throw new Error(`Navigation failed: ${retryErr.message}`);
        }
      }
    }

    // Dynamic wait time based on navigation success and site complexity
    console.log(`[SCREENSHOT] Waiting for page to settle before screenshot`);

    if (navigationSuccess) {
      // Longer wait for successfully loaded heavy sites
      await new Promise(res => setTimeout(res, isMobile ? 2000 : 3000));
      console.log(`[SCREENSHOT] Extended wait completed for ${isMobile ? "mobile" : "desktop"}`);
    } else {
      // Even longer wait for potentially incomplete page loads
      await new Promise(res => setTimeout(res, isMobile ? 3000 : 5000));
      console.log(`[SCREENSHOT] Extra extended wait for incomplete page load`);
    }

    // Check if page has meaningful content before screenshot
    const hasContent = await page.evaluate(() => {
      const body = document.body;
      const hasText = body.textContent && body.textContent.trim().length > 10;
      const hasImages = document.images.length > 0;
      const hasElements = document.querySelectorAll('*').length > 5;

      return hasText || hasImages || hasElements;
    });

    if (!hasContent) {
      console.warn(`[SCREENSHOT] Page appears to have minimal content, waiting longer...`);
      // Extra wait for content to load
      await new Promise(res => setTimeout(res, 3000));
    }

    console.log(`[SCREENSHOT] Content check passed, proceeding with screenshot`);

    // For heavy sites, try to trigger any lazy-loaded content
    if (!isMobile) {
      try {
        console.log(`[SCREENSHOT] Triggering scroll to load lazy content`);
        await page.evaluate(() => {
          // Scroll down a bit to trigger lazy loading
          window.scrollTo(0, 200);
          // Scroll back to top for screenshot
          setTimeout(() => window.scrollTo(0, 0), 500);
        });
        // Wait for scroll-triggered content
        await new Promise(res => setTimeout(res, 1500));
      } catch (scrollErr) {
        console.warn(`[SCREENSHOT] Scroll trigger failed:`, scrollErr.message);
      }
    }

    console.log(`[SCREENSHOT] Taking ${isMobile ? "mobile" : "desktop"} screenshot`);
    const image = await page.screenshot({
      encoding: "base64",
      fullPage: false, // Capture only the viewport area
      type: 'png', // PNG for lossless quality (no quality parameter needed)
      // Note: PNG is lossless, quality parameter not supported
      timeout: 60000, // Increased timeout for heavy sites
    });

    // Validate screenshot isn't blank/white
    const imageSize = image.length;
    console.log(`[SCREENSHOT] ${isMobile ? "Mobile" : "Desktop"} screenshot captured successfully (${imageSize} bytes)`);

    // Check if screenshot is suspiciously small (likely blank)
    if (imageSize < 10000) { // Less than 10KB is likely blank
      console.warn(`[SCREENSHOT] Screenshot suspiciously small (${imageSize} bytes), page may not have loaded properly`);

      // Try one more wait and recapture for heavy sites
      console.log(`[SCREENSHOT] Attempting recapture after additional wait`);
      await new Promise(res => setTimeout(res, 3000));

      const retryImage = await page.screenshot({
        encoding: "base64",
        fullPage: false,
        type: 'png',
        timeout: 30000,
      });

      if (retryImage.length > imageSize) {
        console.log(`[SCREENSHOT] Recapture successful (${retryImage.length} bytes)`);
        return `data:image/png;base64,${retryImage}`;
      }
    }

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
