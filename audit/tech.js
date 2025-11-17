import got from "got";

// ----------------------------------------------------------BROKEN LINK CHECKER (with Anchor Text)

async function checkBrokenLinks(base) {
  const { $ } = base;
  const anchors = $("a[href]")
    .map((_, el) => ({
      url: $(el).attr("href"),
      anchorText: ($(el).text() || "").trim(),
    }))
    .get()
    .filter((l) => l.url && /^https?:\/\//i.test(l.url));

  const limited = anchors.slice(0, 30);
  if (limited.length === 0) {
    return { totalChecked: 0, brokenCount: 0, brokenExamples: [], ok: true, list: [] };
  }

  console.log(`[tech] Checking ${limited.length} links with fallback logic...`);

  async function testLink(url) {
    const opts = {
      timeout: { request: 8000 },
      throwHttpErrors: false,
      followRedirect: true,
      https: { rejectUnauthorized: false },
      headers: { "user-agent": "Mozilla/5.0 (compatible; RankMeTopBot/1.0; +https://rankmetop.net)" },
    };

    try {
      let res = await got.head(url, opts);
      // Some servers disallow HEAD — fallback to GET if needed
      if (!res.statusCode || res.statusCode >= 400) {
        res = await got.get(url, opts);
      }
      return res.statusCode || 0;
    } catch {
      // Retry once with GET
      try {
        const res = await got.get(url, opts);
        return res.statusCode || 0;
      } catch {
        return 0; // treat as unreachable
      }
    }
  }

  const results = await Promise.allSettled(
    limited.map(async ({ url, anchorText }) => {
      const status = await testLink(url);
      return { url, anchorText, status };
    })
  );

  const checked = results.map((r) => r.value).filter(Boolean);

  // Treat 200–399 as valid, ignore 403/429 false negatives
  const broken = checked.filter(
    (r) => r.status === 0 || (r.status >= 400 && r.status < 500 && r.status !== 403 && r.status !== 429)
  );

  return {
    totalChecked: limited.length,
    brokenCount: broken.length,
    brokenExamples: broken.slice(0, 5),
    ok: broken.length === 0,
    list: checked,
  };
}




/* ----------------------------------------------------------
   MAIN TECHNICAL AUDIT
---------------------------------------------------------- */
export async function tech(base) {
  const { $, headers, finalUrl } = base;
  const https = finalUrl.startsWith("https://");

  // --- derive robots/sitemap URLs safely ---
  const robotsHref = new URL("/robots.txt", finalUrl).toString();
  const sitemapHref = new URL("/sitemap.xml", finalUrl).toString();

  const canonical = $("link[rel='canonical']").attr("href") || "";
  const xrobots = (headers["x-robots-tag"] || "").toString().toLowerCase();
  const analytics = /gtag\(|googletagmanager|ga\(|google-analytics\.com|plausible\.io|umami\.is/i.test($.html());

  /* ---------- ROBOTS.TXT CHECK ---------- */
  const robots = {
    url: robotsHref,
    present: false,
    optimized: false,
    content: "",
    status: null,
  };

  try {
    const res = await got(robotsHref, {
      timeout: { request: 8000 },
      throwHttpErrors: false,
      followRedirect: true,
      https: { rejectUnauthorized: false },
    });
    robots.status = res.statusCode;
    if (res.statusCode >= 200 && res.statusCode < 300 && res.body?.trim()) {
      robots.present = true;
      robots.content = res.body.trim();
      const lower = robots.content.toLowerCase();
      const hasUserAgent = lower.includes("user-agent");
      const hasDisallow = lower.includes("disallow");
      const hasSitemap = lower.includes("sitemap");
      robots.optimized = hasUserAgent || hasDisallow || hasSitemap;
    }
  } catch (err) {
    console.warn(`[tech] robots.txt fetch failed: ${err.message}`);
  }

  /* ---------- SITEMAP CHECK ---------- */
  const sitemap = {
    url: sitemapHref,
    present: false,
    optimized: false,
    urlCount: 0,
    status: null,
  };

  try {
    const res = await got(sitemapHref, {
      timeout: { request: 8000 },
      throwHttpErrors: false,
      followRedirect: true,
      https: { rejectUnauthorized: false },
    });
    sitemap.status = res.statusCode;
    if (res.statusCode >= 200 && res.statusCode < 300 && res.body?.length > 0) {
      sitemap.present = true;
      const body = res.body.toString();
      const ctype = (res.headers["content-type"] || "").toLowerCase();

      let allUrls = [];
      if (ctype.includes("xml")) {
        const locMatches = body.match(/<loc>(https?:\/\/[^<]+)<\/loc>/gi);
        allUrls = locMatches
          ? locMatches.map((x) => x.replace(/<\/?loc>/gi, "").trim())
          : [];
      } else {
        const rawUrls = body.match(/https?:\/\/[^\s<>"']+/gi) || [];
        const host = new URL(sitemapHref).hostname;
        allUrls = rawUrls.filter((u) => u.includes(host));
      }

      sitemap.urlCount = allUrls.length;
      sitemap.optimized = sitemap.urlCount > 0;
      console.log(`[tech] Sitemap detected ${sitemap.urlCount} URLs`);
    }
  } catch (err) {
    console.warn(`[tech] sitemap fetch failed: ${err.message}`);
  }

  /* ---------- SCHEMA.ORG DETECTION ---------- */
  // --- Schema.org structured data detection (optimized logic) ---
  let schemaOrgFound = false;
  let schemaOrgOptimized = false;

  try {
    const jsonLd = $("script[type='application/ld+json']").toArray();
    const jsonLdCount = jsonLd.length;

    if (jsonLdCount > 0) {
      // Check how many contain schema.org
      const schemaScripts = jsonLd.filter((el) => {
        const txt = $(el).html() || "";
        return /schema\.org/i.test(txt);
      });

      schemaOrgFound = schemaScripts.length > 0;

      // ✅ Optimized only if exactly one schema and it contains schema.org
      schemaOrgOptimized = schemaScripts.length === 1 && jsonLdCount === 1;
    }

    // If no JSON-LD, fallback check for Microdata or RDFa
    if (!schemaOrgFound) {
      const micro = $("[itemscope][itemtype*='schema.org'], [typeof*='schema.org']").length;
      schemaOrgFound = micro > 0;
      schemaOrgOptimized = schemaOrgFound && jsonLdCount <= 1;
    }
  } catch (e) {
    console.warn("[TECH] Schema.org detection failed:", e.message);
  }
  /* ---------- BROKEN LINK SCAN ---------- */
  const brokenLinks = await checkBrokenLinks(base);

  // --- Noindex detection ---
  const hasNoindexHeader = xrobots.includes("noindex");

  // Detect meta-based noindex (<meta name="robots" content="noindex">)
  const hasNoindexMeta = $("meta[name='robots']")
    .toArray()
    .some(el => {
      const content = ($(el).attr("content") || "").toLowerCase();
      return content.includes("noindex");
    });

  const noindex = {
    header: hasNoindexHeader,
    meta: hasNoindexMeta,
    present: hasNoindexHeader || hasNoindexMeta,
  };

  /* ---------- RETURN TECH DATA ---------- */
  return {
    ssl: { enabled: https },
    httpsRedirect: { ok: https },
    robots,
    sitemap,
    canonical: { value: canonical, present: !!canonical },
    schemaOrg: { present: schemaOrgFound, optimized: schemaOrgOptimized },
    analytics: { present: analytics },
    noindex,
    brokenLinks,
    viewport: { present: $("meta[name='viewport']").attr("content")?.includes("width=device-width") || false },
    favicon: { present: $("link[rel='icon'], link[rel='shortcut icon']").length > 0 },
    iframes: { used: $("iframe").length > 0 }
  };
}
