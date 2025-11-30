import got from "got";

// --- Optional PSI toggle ---
const USE_PSI = process.env.SKIP_PSI !== "true";

async function fetchPageSpeedInsights(url) {
  const apiKey = process.env.PSI_API_KEY;
  if (!apiKey || !USE_PSI) return { mobile: { score: null }, desktop: { score: null } };

  // Basic screenshot validation (accept any valid screenshot)
  function validateScreenshot(screenshot) {
    if (!screenshot) return false;

    try {
      // Check if it's valid base64 image data
      const isValidBase64 = /^data:image\/[a-z]+;base64,/.test(screenshot);
      if (!isValidBase64) return false;

      // Extract and check base64 data exists
      const base64Data = screenshot.split(',')[1];
      if (!base64Data || base64Data.length < 1000) return false; // Minimum reasonable size

      return true;
    } catch (e) {
      console.warn(`[PSI] Screenshot validation failed:`, e.message);
      return false;
    }
  }

  // Quality scoring for choosing between multiple candidates (optional enhancement)
  function scoreScreenshotQuality(screenshot, strategy) {
    if (!screenshot) return 0;

    try {
      const base64Data = screenshot.split(',')[1];
      if (!base64Data) return 0;

      const dataSize = base64Data.length;
      const decodedSize = (dataSize * 3) / 4; // Approximate decoded size

      let quality = 1; // Base quality

      // Size-based quality (larger = potentially better quality)
      if (decodedSize > 500000) quality += 2; // > ~500KB decoded = high quality
      else if (decodedSize > 200000) quality += 1; // > ~200KB decoded = good quality

      // Check for PNG format (better quality than JPG for screenshots)
      if (screenshot.includes('data:image/png')) quality += 1;

      return Math.max(0, quality);
    } catch (e) {
      return 0;
    }
  }

  const run = async (strategy) => {
    let bestScreenshot = null;
    let bestQuality = 0;
    let attempts = [];

    // Try up to 2 attempts for desktop with different parameters
    const maxAttempts = strategy === 'desktop' ? 2 : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Enhanced parameters for better screenshot quality
        let additionalParams = '';
        if (strategy === 'desktop') {
          additionalParams = '&screenshot=true&locale=en';
          // Add attempt-specific parameters for quality improvement
          if (attempt > 1) {
            // On retry, add additional parameters that might improve quality
            additionalParams += '&strategy=desktop';
          }
        }

        const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&category=performance&key=${apiKey}${additionalParams}`;

        const res = await got(endpoint, {
          timeout: { request: 30000 },
          throwHttpErrors: false,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });

        if (res.statusCode !== 200) {
          console.warn(`[PSI] Attempt ${attempt}/${maxAttempts} failed with status ${res.statusCode}`);
          continue;
        }

        const data = JSON.parse(res.body || "{}");
        const lhr = data.lighthouseResult || {};
        const perfScore = Math.round((lhr.categories?.performance?.score ?? 0) * 100);

        const audits = lhr.audits || {};
        const val = (id) => +(audits[id]?.numericValue ?? 0) / 1000;

        // Enhanced screenshot extraction with quality prioritization
        const screenshotCandidates = [];

        // Try multiple screenshot sources for desktop
        if (strategy === 'desktop') {
          // Primary: final-screenshot (viewport, what user sees first)
          if (audits["final-screenshot"]?.details?.data) {
            screenshotCandidates.push({
              data: audits["final-screenshot"].details.data,
              source: 'final-screenshot',
              priority: 3
            });
          }

          // Secondary: full-page-screenshot (if viewport is poor quality)
          if (audits["full-page-screenshot"]?.screenshot?.data) {
            screenshotCandidates.push({
              data: audits["full-page-screenshot"].screenshot.data,
              source: 'full-page-screenshot',
              priority: 2
            });
          }

          // Tertiary: screenshot-thumbnails (as fallback)
          if (audits["screenshot-thumbnails"]?.details?.data?.[0]) {
            screenshotCandidates.push({
              data: audits["screenshot-thumbnails"].details.data[0],
              source: 'screenshot-thumbnails',
              priority: 1
            });
          }
        } else {
          // Mobile: simpler approach
          if (audits["final-screenshot"]?.details?.data) {
            screenshotCandidates.push({
              data: audits["final-screenshot"].details.data,
              source: 'final-screenshot',
              priority: 2
            });
          }
          if (audits["full-page-screenshot"]?.screenshot?.data) {
            screenshotCandidates.push({
              data: audits["full-page-screenshot"].screenshot.data,
              source: 'full-page-screenshot',
              priority: 1
            });
          }
        }

        // Find the best quality screenshot from candidates
        for (const candidate of screenshotCandidates) {
          if (validateScreenshot(candidate.data)) {
            const qualityScore = scoreScreenshotQuality(candidate.data, strategy);
            if (qualityScore > bestQuality) {
              bestScreenshot = candidate.data;
              bestQuality = qualityScore;
              console.log(`[PSI] Found better ${strategy} screenshot from ${candidate.source} (quality score: ${qualityScore})`);
            }
          }
        }

        attempts.push({
          attempt,
          success: true,
          screenshotFound: !!bestScreenshot,
          quality: bestQuality
        });

        // If we got any valid screenshot, we can stop trying
        if (bestScreenshot) {
          break;
        }

      } catch (e) {
        console.warn(`[PSI] ${strategy} attempt ${attempt}/${maxAttempts} failed:`, e.message);
        attempts.push({
          attempt,
          success: false,
          error: e.message
        });
      }
    }

    // Log quality improvement results
    if (strategy === 'desktop' && attempts.length > 1) {
      console.log(`[PSI] Desktop screenshot quality improvement: ${attempts.map(a => `attempt ${a.attempt}: ${a.success ? (a.screenshotFound ? `quality ${a.quality}` : 'no screenshot') : 'failed'}`).join(', ')}`);
    }

    // Final validation - ensure we return any valid screenshot
    if (bestScreenshot && !validateScreenshot(bestScreenshot)) {
      console.warn(`[PSI] Final screenshot validation failed for ${strategy}`);
      bestScreenshot = null;
    }

    const result = {
      strategy,
      score: null, // Will be set below if we have successful data
      fcp: 0,
      lcp: 0,
      tbt: 0,
      cls: 0,
      si: 0,
      screenshot: bestScreenshot,
    };

    // Try to get performance data from the last successful attempt
    try {
      // Re-run once more to get performance data (since we might have stopped early for quality)
      const finalEndpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&category=performance&key=${apiKey}`;
      const finalRes = await got(finalEndpoint, {
        timeout: { request: 25000 },
        throwHttpErrors: false
      });

      if (finalRes.statusCode === 200) {
        const finalData = JSON.parse(finalRes.body || "{}");
        const finalLhr = finalData.lighthouseResult || {};
        result.score = Math.round((finalLhr.categories?.performance?.score ?? 0) * 100);

        const finalAudits = finalLhr.audits || {};
        const finalVal = (id) => +(finalAudits[id]?.numericValue ?? 0) / 1000;

        result.fcp = +finalVal("first-contentful-paint").toFixed(2);
        result.lcp = +finalVal("largest-contentful-paint").toFixed(2);
        result.tbt = +(finalAudits["total-blocking-time"]?.numericValue / 1000 || 0).toFixed(2);
        result.cls = +(finalAudits["cumulative-layout-shift"]?.numericValue || 0).toFixed(3);
        result.si = +finalVal("speed-index").toFixed(2);
      }
    } catch (e) {
      console.warn(`[PSI] Failed to get final performance data for ${strategy}:`, e.message);
    }

    return result;
  };

  const [mobile, desktop] = await Promise.allSettled([run("mobile"), run("desktop")]);
  return {
    mobile: mobile.value || { score: null },
    desktop: desktop.value || { score: null },
  };
}

export async function performanceAudit(base) {
  const { resources, timing, finalUrl, headers } = base;

  // --- Calculate transfer sizes concurrently ---
  const totals = { total: 0, css: 0, js: 0, img: 0, other: 0 };
  const count = { html: 1, js: 0, css: 0, img: 0, total: 1 };

  for (const r of resources) {
    totals.total += r.size || 0;
    if (/css/i.test(r.type)) totals.css += r.size;
    else if (/javascript/i.test(r.type)) totals.js += r.size;
    else if (/image/i.test(r.type)) totals.img += r.size;
    else totals.other += r.size;

    if (r.tag === "script") count.js++;
    if (r.tag === "link") count.css++;
    if (r.tag === "img") count.img++;
  }
  count.total = count.js + count.css + count.img + 1;

  // --- Compression checks in parallel ---
  const testResources = resources.slice(0, 5);
  const compressionResults = await Promise.allSettled(
    testResources.map(r =>
      got.head(r.url, { throwHttpErrors: false, timeout: { request: 5000 } })
        .then(h => h.headers["content-encoding"] || "")
        .catch(() => "")
    )
  );
  const compressedCount = compressionResults.filter(r => /(gzip|br)/i.test(r.value || "")).length;
  const compression = { brotliOrGzip: compressedCount / (testResources.length || 1) >= 0.6 };

  // --- HTTP/2 detection concurrently ---
  const httpVersions = await Promise.allSettled(
    testResources.map(r =>
      got.head(r.url, { throwHttpErrors: false, timeout: { request: 5000 } })
        .then(h => h.httpVersion || "")
        .catch(() => "")
    )
  );
  const http2Count = httpVersions.filter(r => /^2/.test(r.value)).length;
  const http2 = http2Count >= Math.ceil(testResources.length * 0.6);

  // --- PSI data (async but awaited) ---
  const psi = await fetchPageSpeedInsights(finalUrl);

  const downloadSizeMB = +(totals.total / (1024 * 1024)).toFixed(2);
  const jsErrors = 0;

  let score = 100;
  if (downloadSizeMB > 5) score -= 15;
  if (!compression.brotliOrGzip) score -= 10;
  if (!http2) score -= 10;

  const psiScores = [psi.mobile?.score, psi.desktop?.score].filter(x => x != null);
  if (psiScores.length) {
    const avg = psiScores.reduce((a, b) => a + b, 0) / psiScores.length;
    if (avg < 50) score -= 20;
    else if (avg < 70) score -= 10;
    else if (avg < 90) score -= 5;
  }



  return {
    load: timing,
    downloadSizeMB,
    breakdownMB: {
      html: 0,
      css: +(totals.css / (1024 * 1024)).toFixed(2),
      js: +(totals.js / (1024 * 1024)).toFixed(2),
      images: +(totals.img / (1024 * 1024)).toFixed(2),
      other: +(totals.other / (1024 * 1024)).toFixed(2),
    },
    resourceCounts: count,
    compression,
    http2,
    jsErrors,
    pageSpeedInsights: psi,
    score: Math.max(0, Math.min(100, Math.round(score))),
  };
}
