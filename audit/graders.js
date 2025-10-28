const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, n));
const letter = (s) =>
  s >= 97
    ? "A+"
    : s >= 90
      ? "A"
      : s >= 80
        ? "A-"
        : s >= 70
          ? "B"
          : s >= 60
            ? "C"
            : s >= 50
              ? "D"
              : "F";

export function gradeAll(sections) {
  const on = gradeOnpage(sections.onpage);
  const pe = gradePerformance(sections.performance);
  const so = gradeSocial(sections.social);
  const tl = gradeTechLocal(sections.tech, sections.local, sections.onpage);

  const overallScore = Math.round(
    (on.score + pe.score + so.score + tl.score) / 4
  );

  return {
    onpage: on,
    performance: pe,
    social: so,
    techlocal: tl,
    overall: { score: overallScore, letter: letter(overallScore) },
  };
}

/* =====================
   ON-PAGE
===================== */
function gradeOnpage(o) {
  let s = 100;

  if (!o.title.ok) s -= 14;
  if (!o.metaDescription.ok) s -= 14;
  const oneh1 = o.headingUsage.levels.h1 === 1;
  if (!oneh1) s -= 16;

  const hasH2 = o.headingUsage.levels.h2 > 0;
  const hasH3 = o.headingUsage.levels.h3 > 0;
  if (!hasH2 || !hasH3) s -= 14;

  if (o.contentAmount.thin) s -= 20;
  if (o.altAttributes.missing > 0) s -= 15;
  if (!o.lang.present) s -= 6;


  return { score: clamp(s), letter: letter(s) };
}

/* =====================
   TECH + LOCAL (includes usability)
===================== */
function gradeTechLocal(t, l, o) {
  let s = 100;

  // Technical
  if (!t.ssl.enabled) s -= 15;
  if (!o.canonical.present) s -= 10;
  if (!t.httpsRedirect.ok) s -= 8;

   // Broken links
  if (Array.isArray(t.brokenLinks?.list) && t.brokenLinks.list.length > 0) {
    const count = t.brokenLinks.list.length;
    if (count > 8) s -= 14;
    else if (count > 5) s -= 10;
    else s -= 5;
  }
 
  if (t.schemaOrg) {
    if (t.schemaOrg.optimized) s -= 0;
    else if (t.schemaOrg.present) s -= 5;
    else s -= 15;
  } else {
    s -= 15;
  }
  
  if (!t.robots.present) s -= 8;
  else if (!t.robots.optimized) s -= 4;

  if (!t.sitemap.present) s -= 12;
  else if (!t.sitemap.optimized) s -= 6;


  // Noindex
  if (t.noindex?.present) {
    if (t.noindex.header && t.noindex.meta) s -= 8;
    else s -= 6;
  }

 if (!t.viewport.present) s -= 5;
  if (!t.favicon.present) s -= 5;


  return { score: clamp(s), letter: letter(s) };
}

/* =====================
   PERFORMANCE
===================== */
function gradePerformance(p) {
  let s = 100;

  if (p.downloadSizeMB > 5) s -= 30;
  else if (p.downloadSizeMB > 2) s -= 15;

  const compressionOk = !!p.compression?.brotliOrGzip;
  const http2Ok = !!p.http2;

  if (!compressionOk) s -= 15;
  if (!http2Ok) s -= 20;

  const m = p.pageSpeedInsights?.mobile?.score ?? null;
  const d = p.pageSpeedInsights?.desktop?.score ?? null;

  if (m != null || d != null) {
    const bothScores = [m, d].filter((v) => v != null);
    const avgPSI = bothScores.length
      ? bothScores.reduce((a, b) => a + b, 0) / bothScores.length
      : 0;

    if (avgPSI >= 90) s -= 0;
    else if (avgPSI >= 80) s -= 10;
    else if (avgPSI >= 50) s -= 24;
    else s -= 35;
  }

  return { score: clamp(s), letter: letter(s) };
}

/* =====================
   SOCIAL
===================== */
function gradeSocial(soc) {
  let s = 100;
  if (!soc.links.facebook) s -= 15;
  if (!soc.links.instagram) s -= 15;
  if (!soc.links.twitter) s -= 15;
  if (!soc.links.linkedin) s -= 15;
  if (!soc.links.youtube) s -= 15;
  if (!soc.openGraph.present) s -= 15;
  if (!soc.twitterCards.present) s -= 10;
  return { score: clamp(s), letter: letter(s) };
}
