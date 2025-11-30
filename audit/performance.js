import got from "got";

// --- Optional PSI toggle ---
const USE_PSI = process.env.SKIP_PSI !== "true";

async function fetchPageSpeedInsights(url) {
  const apiKey = process.env.PSI_API_KEY;
  if (!apiKey || !USE_PSI) return { mobile: { score: null }, desktop: { score: null } };

  const run = async (strategy) => {
    try {
      const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&category=performance&key=${apiKey}`;
      const res = await got(endpoint, { timeout: { request: 25000 }, throwHttpErrors: false });
      const data = JSON.parse(res.body || "{}");
      const lhr = data.lighthouseResult || {};
      const perfScore = Math.round((lhr.categories?.performance?.score ?? 0) * 100);

      const audits = lhr.audits || {};
      const val = (id) => +(audits[id]?.numericValue ?? 0) / 1000;

      // Extract screenshot from PSI (only for mobile as requested)
      let screenshot = null;
      if (strategy === 'mobile') {
        // For mobile, prioritize final-screenshot (viewport screenshot)
        screenshot = audits["final-screenshot"]?.details?.data
          || audits["full-page-screenshot"]?.screenshot?.data
          || null;

        if (screenshot) {
          console.log(`[PSI] Captured mobile screenshot from ${audits["final-screenshot"]?.details?.data ? 'final-screenshot' : 'full-page-screenshot'}`);
        }
      }

      return {
        strategy,
        score: perfScore,
        fcp: +val("first-contentful-paint").toFixed(2),
        lcp: +val("largest-contentful-paint").toFixed(2),
        tbt: +(audits["total-blocking-time"]?.numericValue / 1000 || 0).toFixed(2),
        cls: +(audits["cumulative-layout-shift"]?.numericValue || 0).toFixed(3),
        si: +val("speed-index").toFixed(2),
        screenshot, // Only included for mobile
      };
    } catch (e) {
      console.warn(`[PSI] ${strategy} failed:`, e.message);
      return { strategy, score: null };
    }
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
