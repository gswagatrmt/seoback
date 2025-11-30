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

// ------------------ Site Complexity Detection (Memory-Safe Strategy) ------------------
async function detectSiteComplexity(url) {
  console.log(`[COMPLEXITY] Analyzing site complexity for ${url}`);

  let page = null;
  const complexity = {
    isHeavy: false,
    reasons: [],
    loadTime: 0,
    resourceCount: 0
  };

  try {
    const browser = await getBrowser();
    page = await browser.newPage();

    // Set minimal viewport for quick analysis
    await page.setViewport({ width: 800, height: 600 });

    // Track resources and timing
    let resourceCount = 0;
    const startTime = Date.now();

    page.on('response', () => {
      resourceCount++;
    });

    // Quick navigation test (15 seconds max)
    console.log(`[COMPLEXITY] Testing site responsiveness...`);

    try {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 15000 // 15 seconds for complexity check
      });

      const loadTime = Date.now() - startTime;
      complexity.loadTime = loadTime;
      complexity.resourceCount = resourceCount;

      console.log(`[COMPLEXITY] Site analysis: ${loadTime}ms load time, ${resourceCount} resources`);

      // Determine if site is heavy based on multiple factors
      if (loadTime > 8000) {
        complexity.isHeavy = true;
        complexity.reasons.push(`slow load (${loadTime}ms)`);
      }

      if (resourceCount > 50) {
        complexity.isHeavy = true;
        complexity.reasons.push(`many resources (${resourceCount})`);
      }

      // Check for heavy frameworks/scripts
      const heavyFrameworks = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script[src]'));
        const hasReact = scripts.some(s => s.src.includes('react'));
        const hasVue = scripts.some(s => s.src.includes('vue'));
        const hasAngular = scripts.some(s => s.src.includes('angular'));
        const hasJQuery = scripts.some(s => s.src.includes('jquery'));

        return { hasReact, hasVue, hasAngular, hasJQuery };
      });

      if (heavyFrameworks.hasReact || heavyFrameworks.hasVue || heavyFrameworks.hasAngular) {
        complexity.isHeavy = true;
        complexity.reasons.push('heavy framework detected');
      }

    } catch (timeoutErr) {
      complexity.isHeavy = true;
      complexity.reasons.push(`timeout during analysis (${timeoutErr.message.includes('timeout') ? 'slow response' : 'connection issue'})`);
      console.log(`[COMPLEXITY] Site analysis timeout - marking as heavy`);
    }

  } catch (err) {
    complexity.isHeavy = true;
    complexity.reasons.push(`analysis error (${err.message})`);
    console.warn(`[COMPLEXITY] Error during complexity analysis:`, err.message);
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
  }

  console.log(`[COMPLEXITY] Final assessment: ${complexity.isHeavy ? 'HEAVY' : 'LIGHT'} site (${complexity.reasons.join(', ') || 'no issues'})`);
  return complexity;
}

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
// ------------------ Memory-Safe Hybrid Screenshot Capture ------------------
// PSI for mobile (fast, low RAM), Smart desktop detection (PSI for heavy sites, Puppeteer for light sites)
async function captureScreens(url, psiData) {
  console.log(`[SCREENSHOT] Starting memory-safe screenshot capture for ${url}`);

  // Start with PSI mobile screenshot (if available)
  const shots = {
    desktop: null,
    mobile: psiData?.mobile?.screenshot || null
  };

  if (shots.mobile) {
    console.log(`[SCREENSHOT] ✓ PSI mobile screenshot available`);
  } else {
    console.log(`[SCREENSHOT] ⚠️  No PSI mobile screenshot available`);
  }

  // SMART DESKTOP SCREENSHOT STRATEGY - Prevent 512MB RAM limit
  console.log(`[SCREENSHOT] Analyzing site complexity to prevent memory issues...`);
  const siteComplexity = await detectSiteComplexity(url);

  if (siteComplexity.isHeavy) {
    console.log(`[SCREENSHOT] 🚨 Heavy site detected - using PSI desktop screenshot to save memory`);
    console.log(`[SCREENSHOT] Heavy site indicators: ${siteComplexity.reasons.join(', ')}`);

    // Use PSI desktop screenshot directly for heavy sites (memory-safe)
    if (psiData?.desktop?.screenshot) {
      shots.desktop = psiData.desktop.screenshot;
      console.log(`[SCREENSHOT] ✓ PSI desktop fallback applied successfully (memory-safe)`);
    } else {
      console.log(`[SCREENSHOT] ❌ No PSI desktop screenshot available for heavy site`);
    }
  } else {
    console.log(`[SCREENSHOT] ✅ Light site detected - attempting Puppeteer desktop screenshot`);

    // Attempt Puppeteer for light sites only with memory monitoring
    try {
      console.log(`[SCREENSHOT] Launching memory-monitored Puppeteer for desktop screenshot`);
      const browser = await getBrowser();

      // Set up memory monitoring to prevent 512MB limit
      let memoryWarningShown = false;
      const memoryCheckInterval = setInterval(() => {
        const memUsage = process.memoryUsage();
        const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
        const totalUsedMB = Math.round((memUsage.heapUsed + memUsage.external) / 1024 / 1024);

        if (totalUsedMB > 450 && !memoryWarningShown) { // Close to 512MB limit
          console.warn(`[MEMORY] ⚠️  High memory usage: ${totalUsedMB}MB - aborting to prevent limit exceedance`);
          memoryWarningShown = true;
          throw new Error('Memory limit approaching - aborting screenshot');
        }
      }, 1000); // Check every 1 second for faster response

      try {
        shots.desktop = await captureDeviceView(browser, url, false);

        if (shots.desktop) {
          console.log(`[SCREENSHOT] ✓ Puppeteer desktop screenshot successful`);
        } else {
          console.warn(`[SCREENSHOT] ⚠️  Puppeteer returned empty screenshot`);
        }
      } finally {
        clearInterval(memoryCheckInterval);
      }

    } catch (err) {
      console.error("[SCREENSHOT] ❌ Puppeteer desktop capture failed:", err.message);

      // Fallback to PSI if Puppeteer fails or hits memory limit
      if (psiData?.desktop?.screenshot) {
        shots.desktop = psiData.desktop.screenshot;
        console.log(`[SCREENSHOT] ✓ PSI desktop fallback applied after Puppeteer failure`);
      } else {
        console.log(`[SCREENSHOT] ❌ No desktop screenshot available`);
      }
    }
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

  // Log final status with memory-safe strategy information
  const desktopSource = shots.desktop ?
    (psiData?.desktop?.screenshot === shots.desktop ? 'PSI (memory-safe)' : 'Puppeteer (light site)') : 'None';
  const mobileSource = shots.mobile ? 'PSI' : 'None';

  const memUsage = process.memoryUsage();
  const currentMemMB = Math.round((memUsage.heapUsed + memUsage.external) / 1024 / 1024);

  console.log(`[SCREENSHOT] Capture complete - Desktop: ${shots.desktop ? '✓ Available' : '✗ Missing'} (${desktopSource}), Mobile: ${shots.mobile ? '✓ Available' : '✗ Missing'} (${mobileSource})`);
  console.log(`[MEMORY] Current memory usage: ${currentMemMB}MB (safe under 512MB limit)`);

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

    // Enhanced navigation strategy for heavy sites with anti-detection
    let navigationSuccess = false;

    // Set additional headers to avoid blocking and improve compatibility
    console.log(`[SCREENSHOT] Setting anti-detection headers`);
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'max-age=0',
    });

    try {
      // Try network idle first with extended timeout for heavy sites
      console.log(`[SCREENSHOT] Attempting navigation with networkidle0 (60s timeout)...`);
      await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });
      console.log(`[SCREENSHOT] Page loaded successfully with networkidle0`);
      navigationSuccess = true;
    } catch (navErr) {
      console.warn(`[SCREENSHOT] ${isMobile ? "Mobile" : "Desktop"} navigation timeout (networkidle0), trying domcontentloaded...`);

      try {
        // Fallback to domcontentloaded with extended timeout
        console.log(`[SCREENSHOT] Attempting navigation with domcontentloaded (45s timeout)...`);
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
        console.log(`[SCREENSHOT] Page loaded with domcontentloaded fallback`);
        navigationSuccess = true;
      } catch (retryErr) {
        if (retryErr.message.includes("timeout") || retryErr.message.includes("Timeout")) {
          console.warn(`[SCREENSHOT] ${isMobile ? "Mobile" : "Desktop"} navigation timeout (domcontentloaded). Attempting minimal load...`);

          try {
            // Last resort: try with minimal wait conditions
            console.log(`[SCREENSHOT] Attempting minimal navigation with load event (30s timeout)...`);
            await page.goto(url, { waitUntil: "load", timeout: 30000 });
            console.log(`[SCREENSHOT] Page loaded with minimal load condition`);
            navigationSuccess = false; // Partial load but better than nothing
          } catch (finalErr) {
            console.error(`[SCREENSHOT] All navigation attempts failed: ${finalErr.message}`);
            navigationSuccess = false;
          }
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

    // Enhanced content validation with multiple checks
    console.log(`[SCREENSHOT] Validating page content...`);
    const contentCheck = await page.evaluate(() => {
      const body = document.body;
      const html = document.documentElement;

      // Multiple content checks
      const checks = {
        hasText: body.textContent && body.textContent.trim().length > 50,
        hasImages: document.images.length > 0,
        hasElements: document.querySelectorAll('*').length > 10,
        hasTitle: document.title && document.title.trim().length > 0,
        hasHeadings: document.querySelectorAll('h1, h2, h3').length > 0,
        hasLinks: document.querySelectorAll('a').length > 0,
        bodyHeight: body.offsetHeight > 100,
        htmlSize: html.innerHTML.length > 1000
      };

      const score = Object.values(checks).filter(Boolean).length;
      return {
        ...checks,
        overallScore: score,
        hasBasicContent: score >= 2 // At least 2 positive checks
      };
    });

    console.log(`[SCREENSHOT] Content validation - Score: ${contentCheck.overallScore}/8, Basic content: ${contentCheck.hasBasicContent ? '✓' : '✗'}`);

    if (!contentCheck.hasBasicContent) {
      console.warn(`[SCREENSHOT] Page appears to have minimal content (score: ${contentCheck.overallScore}), waiting longer...`);
      // Extra wait for content to load on slow/heavy sites
      await new Promise(res => setTimeout(res, 5000));
      console.log(`[SCREENSHOT] Extra wait completed, proceeding with screenshot`);
    } else {
      console.log(`[SCREENSHOT] Content validation passed, proceeding with screenshot`);
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

    // Validate screenshot quality and size
    const imageSize = image.length;
    console.log(`[SCREENSHOT] ${isMobile ? "Mobile" : "Desktop"} screenshot captured (${imageSize} bytes)`);

    // Enhanced validation for blank/invalid screenshots
    if (imageSize < 5000) { // Very small = definitely blank/invalid
      console.error(`[SCREENSHOT] Screenshot critically small (${imageSize} bytes) - likely blank/invalid`);
      return null; // Return null to trigger PSI fallback
    } else if (imageSize < 15000) { // Small = potentially blank
      console.warn(`[SCREENSHOT] Screenshot suspiciously small (${imageSize} bytes), may be blank`);

      // Try one more wait and recapture for heavy sites
      console.log(`[SCREENSHOT] Attempting recapture after additional wait`);
      await new Promise(res => setTimeout(res, 3000));

      try {
        const retryImage = await page.screenshot({
          encoding: "base64",
          fullPage: false,
          type: 'png',
          timeout: 20000,
        });

        if (retryImage.length > imageSize * 1.5) { // Significant improvement
          console.log(`[SCREENSHOT] Recapture successful (${retryImage.length} bytes vs ${imageSize})`);
          return `data:image/png;base64,${retryImage}`;
        } else {
          console.warn(`[SCREENSHOT] Recapture didn't improve quality, using original`);
        }
      } catch (retryErr) {
        console.warn(`[SCREENSHOT] Recapture failed: ${retryErr.message}`);
      }
    } else {
      console.log(`[SCREENSHOT] Screenshot size looks good (${imageSize} bytes)`);
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
