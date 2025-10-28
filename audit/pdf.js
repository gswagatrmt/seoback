// audit/pdf.js
import puppeteer from "puppeteer";

/* ========== Theme ========== */
const BRAND = "#FFD200";
const INK = "#111827";
const MUTED = "#6B7280";
const GOOD = "#16A34A";
const WARN = "#F59E0B";
const BAD = "#DC2626";
const BORDER = "#E5E7EB";

/* ========== Helpers ========== */
function clamp(n, min = 0, max = 100) { return Math.max(min, Math.min(max, n)); }
function ringColor(score){
  const s = Number(score) || 0;
  return s >= 90 ? "#22C55E" : s >= 70 ? "#F59E0B" : "#EF4444";
}

/* ========== SVGs (match frontend intent) ========== */
function fullGaugeSvg(score=0, label="Score", size=160){
  const v = clamp(score);
  const radius = size / 2.6;
  const center = size / 2;
  const c = 2 * Math.PI * radius;
  const dash = ((100 - v) / 100) * c;
  const color = ringColor(v);

  return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${label} ${v}">
  <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${BORDER}" stroke-width="12"/>
  <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${color}" stroke-width="12"
          stroke-dasharray="${c}" stroke-dashoffset="${dash}" stroke-linecap="round"
          transform="rotate(-90 ${center} ${center})"/>
  <text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle"
        font-size="${size*0.30}" font-weight="700" fill="#95a4c4ff">${v}</text>
  <text x="50%" y="${size-10}" text-anchor="middle" font-size="${Math.max(11, size*0.10)}" fill="${MUTED}">${label}</text>
</svg>`;
}

function radarSvg(scores){
  const S = { onpage:0, technical:0, performance:0, social:0, ...scores };
  const vals = [S.onpage, S.technical, S.performance, S.social].map(v => clamp(v));
  const labels = ["On-Page","Technical","Performance","Social"];
  const dims=260, cx=130, cy=130, r=90;

  const point = (i,p)=> {
    const a = (Math.PI*2 * i/vals.length) - Math.PI/2;
    const rr = (p/100)*r;
    return [cx + rr*Math.cos(a), cy + rr*Math.sin(a)];
  };
  const pts = vals.map((v,i)=>point(i,v).join(",")).join(" ");

  return `
<svg width="${dims}" height="${dims}" viewBox="0 0 ${dims} ${dims}" role="img" aria-label="Coverage Radar">
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" stroke="${BORDER}"/>
  ${[0.25,0.5,0.75,1].map(t=>`<circle cx="${cx}" cy="${cy}" r="${r*t}" fill="none" stroke="${BORDER}"/>`).join("")}
  ${vals.map((_,i)=>{ const [x,y]=point(i,100); return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="${BORDER}"/>`; }).join("")}
  <polygon points="${pts}" fill="rgba(255,210,0,.20)" stroke="${BRAND}" />
  ${labels.map((lab,i)=>{ const [x,y]=point(i,112); return `<text x="${x}" y="${y}" font-size="11" fill="${MUTED}" text-anchor="middle">${lab}</text>`; }).join("")}
</svg>`;
}

function psiRing(score=0, label=""){
  const v = Number(score ?? 0);
  const color = v >= 90 ? GOOD : v >= 50 ? WARN : BAD;
  const radius = 50;
  const c = 2 * Math.PI * radius;
  const dash = ((100 - (v||0)) / 100) * c;

  return `
<svg width="160" height="160" viewBox="0 0 160 160" role="img" aria-label="${label} PSI ${v}">
  <circle cx="80" cy="80" r="${radius}" fill="none" stroke="${BORDER}" stroke-width="12"/>
  <circle cx="80" cy="80" r="${radius}" fill="none" stroke="${color}" stroke-width="12"
          stroke-dasharray="${c}" stroke-dashoffset="${dash}" stroke-linecap="round"
          transform="rotate(-90 80 80)"/>
  <text x="50%" y="52%" text-anchor="middle" font-size="32" font-weight="700" fill="${color}">${isNaN(v) ? "—" : v}</text>
  <text x="50%" y="70%" text-anchor="middle" font-size="13" fill="${MUTED}">${label}</text>
</svg>`;
}

/* ========== HTML Template ========== */
function htmlTemplate(payload){
  const { meta={}, grades={}, sections={} } = payload || {};
  const url = meta.url || "Unknown URL";
  const fetched = new Date(meta.fetchedAt || Date.now()).toLocaleString();

  const scores = {
    onpage: grades?.onpage?.score ?? 0,
    technical: grades?.techlocal?.score ?? 0,
    performance: grades?.performance?.score ?? 0,
    social: grades?.social?.score ?? 0
  };

  const overall = grades?.overall?.score ?? 0;
  const letter = grades?.overall?.letter ?? "N/A";

  const on = sections.onpage || {};
  const us = sections.usability || {};
  const pe = sections.performance || {};
  const so = sections.social || {};
  const te = sections.tech || {};
  const lo = sections.local || {};

  const kw = on.keywordConsistency || { keywords: [], phrases: [] };

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>RankMeTop SEO Audit – Full Report</title>
<style>
  @page { size: A4; margin: 20mm 14mm 18mm; }
  body{ font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:${INK}; background:#fff; }
  h1,h2,h3{ margin:0 0 8px }
  header{ display:flex; align-items:center; justify-content:space-between; margin-bottom:8px }
  .muted{ color:${MUTED} }
  .badge{ display:inline-block; min-width:40px; padding:4px 10px; border-radius:8px; font-weight:800; background:#111827; color:${BRAND}; }
  .chip{ display:inline-flex; align-items:center; gap:8px; border:1px solid ${BORDER}; border-radius:999px; padding:6px 10px; background:#fff; }
  .grid{ display:grid; gap:12px }
  .grid-2{ grid-template-columns:1fr 1fr }
  .card{ border:1px solid ${BORDER}; border-radius:12px; padding:12px; background:#fff; }
  .kpis{ display:grid; grid-template-columns: repeat(4, 1fr); gap:8px }
  .kpi{ border:1px solid ${BORDER}; border-radius:10px; padding:10px; }
  .kpi .label{ font-size:12px; color:${MUTED} }
  .kpi .val{ font-size:16px; font-weight:800 }
  .table{ width:100%; border-collapse:collapse; table-layout: fixed; }
  .table th,.table td{ border-bottom:1px solid ${BORDER}; padding:8px; text-align:left; vertical-align:top; word-wrap:break-word }
  .table th{ color:${MUTED}; width:38% }
  .table thead th{ background:#f3f4f6 }
  .section{ break-inside: avoid }
  .pb{ page-break-before: always }
  .hero{ border:1px solid ${BORDER}; border-radius:16px; padding:14px; background:#fff }
  .row{ display:flex; align-items:center; justify-content:space-between; gap:12px }
  .section-title{ font-size:18px; font-weight:800; color:#fff; padding:12px 14px; border-radius:10px; margin-bottom:10px; }
  .note{ font-size:12px; color:${MUTED} }
  /* device frames */
  .device-wrap{ display:flex; gap:18px; align-items:flex-start; justify-content:center; flex-wrap:wrap }
  .phone{ width:205px; aspect-ratio:9/16; border:7px solid #111827; border-radius:28px; overflow:hidden; background:#000 }
  .desktop{ width:540px; aspect-ratio:16/9; border:6px solid #111827; border-radius:10px; overflow:hidden; background:#000 }
  img.screenshot{ width:100%; height:100%; object-fit:cover; object-position:top; display:block }
  .ok{ color:${GOOD}; font-weight:700 }
  .bad{ color:${BAD}; font-weight:700 }
  .center{ text-align:center }
</style>
</head>
<body>

<!-- COVER -->
<section class="hero" style="margin-bottom:12px;">
  <header>
    <div>
      <div class="muted" style="font-size:12px;">Website Report for</div>
      <h1 style="font-size:22px">${url}</h1>
      <div class="muted" style="font-size:12px">Fetched: ${fetched}</div>
    </div>
    <div><span class="badge">RankMeTop</span></div>
  </header>

  <div class="grid grid-2" style="margin-top:8px;">
    <div class="card">
      <div class="row">
        <h2>Overall</h2>
        <span class="chip"><strong>${letter}</strong><span class="muted">Score ${overall}</span></span>
      </div>
      <div style="display:flex; align-items:center; gap:16px; margin-top:6px; flex-wrap:wrap;">
        ${fullGaugeSvg(overall,"Overall",160)}
        <div class="kpis" style="flex:1; min-width:260px">
          <div class="kpi"><div class="label">On-Page</div><div class="val">${grades?.onpage?.score ?? "—"}</div></div>
          <div class="kpi"><div class="label">Technical</div><div class="val">${grades?.techlocal?.score ?? "—"}</div></div>
          <div class="kpi"><div class="label">Performance</div><div class="val">${grades?.performance?.score ?? "—"}</div></div>
          <div class="kpi"><div class="label">Social</div><div class="val">${grades?.social?.score ?? "—"}</div></div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>Coverage</h2>
      <div class="center" style="margin-top:6px;">
        ${radarSvg(scores)}
      </div>
    </div>
  </div>
</section>

<!-- DEVICE RENDERING -->
<section class="card pb">
  <h2>Device Rendering View</h2>
  <div class="device-wrap" style="margin-top:10px;">
    <div>
      <h3 class="center" style="color:#374151; margin-bottom:6px;">Mobile View</h3>
      <div class="phone">
        ${meta.screenshotMobile ? `<img class="screenshot" src="${meta.screenshotMobile}" alt="Mobile rendering"/>`
                                : `<div class="center" style="color:${MUTED}; padding-top:40%;">Mobile preview unavailable</div>`}
      </div>
    </div>
    <div>
      <h3 class="center" style="color:#374151; margin-bottom:6px;">Desktop View</h3>
      <div class="desktop">
        ${meta.screenshotDesktop ? `<img class="screenshot" src="${meta.screenshotDesktop}" alt="Desktop rendering"/>`
                                 : `<div class="center" style="color:${MUTED}; padding-top:20%;">Desktop preview unavailable</div>`}
      </div>
    </div>
  </div>
</section>

<!-- SERP PREVIEW -->
<section class="card pb">
  <h2>SERP Snippet Preview</h2>
  <div class="section">
    <div class="muted" style="font-size:12px; margin-top:6px">${on.serpPreview?.url || ""}</div>
    <div style="color:#1A0DAB; font-weight:700; font-size:18px; margin:4px 0 6px 0">${(on.serpPreview?.title || "(No title found)")}</div>
    <div style="color:#4d5156; font-size:14px;">${(on.serpPreview?.description || "(No meta description found)")}</div>
  </div>
</section>

<!-- ON-PAGE -->
<section class="pb">
  <div class="section-title" style="background:${ringColor(grades?.onpage?.score||0)}">On-Page SEO Results</div>
  <div class="card section">
    <table class="table">
      <tr><th>Title length</th><td>${on?.title?.length ?? "—"} ${on?.title?.ok ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'}</td></tr>
      <tr><th>Meta description length</th><td>${on?.metaDescription?.length ?? "—"} ${on?.metaDescription?.ok ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'}</td></tr>
      <tr><th>H1 present</th><td>${on?.headingUsage?.h1Present ? "Yes" : "No"} ${on?.headingUsage?.h1Present ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'}</td></tr>
      <tr><th>Headings (H2..H6)</th><td>
        H2:${on?.headingUsage?.levels?.h2 ?? 0},
        H3:${on?.headingUsage?.levels?.h3 ?? 0},
        H4:${on?.headingUsage?.levels?.h4 ?? 0},
        H5:${on?.headingUsage?.levels?.h5 ?? 0},
        H6:${on?.headingUsage?.levels?.h6 ?? 0}
      </td></tr>
      <tr><th>Word count</th><td>${on?.contentAmount?.wordCount ?? "—"} ${!on?.contentAmount?.thin ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'}</td></tr>
      <tr><th>Images missing ALT</th><td>${on?.altAttributes?.missing ?? "—"} ${(on?.altAttributes?.missing ?? 0) === 0 ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'}</td></tr>
      <tr><th>Lang</th><td>${on?.lang?.value || "—"} ${on?.lang?.value ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'}</td></tr>
      <tr><th>Hreflang tags</th><td>${on?.hreflang?.values?.length ?? 0} ${((on?.hreflang?.values?.length ?? 0) > 0) ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'}</td></tr>
      <tr><th>Canonical</th><td>${on?.canonical?.present ? "Present" : "Missing"} ${on?.canonical?.present ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'}</td></tr>
    </table>
    ${on?.headingUsage?.h1Values?.length ? `
      <h3 style="margin-top:10px;">H1 Text(s)</h3>
      <table class="table">
        <thead><tr><th style="width:40px;">#</th><th>H1 Text</th></tr></thead>
        <tbody>
          ${on.headingUsage.h1Values.map((t,i)=>`<tr><td>${i+1}</td><td><em>${t}</em></td></tr>`).join("")}
        </tbody>
      </table>
    `: ""}
  </div>

  <div class="card section" style="margin-top:10px;">
    <h3>Keyword Consistency</h3>
    <table class="table">
      <thead><tr><th>Keyword</th><th>Title</th><th>Meta</th><th>Headings</th><th>Frequency</th></tr></thead>
      <tbody>
        ${(kw.keywords||[]).length
          ? kw.keywords.map(k=>`
              <tr>
                <td style="text-transform:capitalize">${k.keyword}</td>
                <td>${k.inTitle ? '✓' : '—'}</td>
                <td>${k.inMeta ? '✓' : '—'}</td>
                <td>${k.inHeadings ? '✓' : '—'}</td>
                <td>${k.frequency ?? 0}</td>
              </tr>`).join("")
          : `<tr><td colspan="5" class="center muted">No keywords found.</td></tr>`}
      </tbody>
    </table>

    ${(kw.phrases||[]).length ? `
      <h3 style="margin-top:10px;">Two-Word Phrases</h3>
      <table class="table">
        <thead><tr><th>Phrase</th><th>Title</th><th>Meta</th><th>Headings</th><th>Frequency</th></tr></thead>
        <tbody>
          ${kw.phrases.map(p=>`
            <tr>
              <td style="text-transform:capitalize">${p.phrase}</td>
              <td>${p.inTitle ? '✓' : '—'}</td>
              <td>${p.inMeta ? '✓' : '—'}</td>
              <td>${p.inHeadings ? '✓' : '—'}</td>
              <td>${p.frequency ?? 0}</td>
            </tr>`).join("")}
        </tbody>
      </table>`: ""}
  </div>
</section>

<!-- TECHNICAL & LOCAL -->
<section class="pb">
  <div class="section-title" style="background:${ringColor(grades?.techlocal?.score||0)}">Technical Results</div>

  <div class="card section">
    <table class="table">
      <tr><th>SSL</th><td>${te?.ssl?.enabled ? "Enabled" : "Disabled"} ${te?.ssl?.enabled ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'}</td></tr>
      <tr><th>HTTPS redirect</th><td>${te?.httpsRedirect?.ok ? "Yes" : "No"} ${te?.httpsRedirect?.ok ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'}</td></tr>
      <tr><th>robots.txt</th><td>${te?.robots?.present ? te?.robots?.url : "Missing"} ${te?.robots?.present ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'}</td></tr>
      <tr><th>sitemap.xml</th><td>${te?.sitemap?.present ? te?.sitemap?.url : "Missing"} ${te?.sitemap?.present ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'}</td></tr>
      <tr><th>Analytics</th><td>${te?.analytics?.present ? "Detected" : "Missing"} ${te?.analytics?.present ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'}</td></tr>
      <tr><th>Canonical</th><td>${on?.canonical?.present ? (on?.canonical?.value || "Present") : "Missing"} ${on?.canonical?.present ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'}</td></tr>
      <tr><th>Noindex</th><td>${te?.noindex?.present ? "Present" : "Not detected"} ${!te?.noindex?.present ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'}</td></tr>
      <tr><th>LocalBusiness schema</th><td>${lo?.localBusinessSchema?.present ? "Present" : "Missing"} ${lo?.localBusinessSchema?.present ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'}</td></tr>
      <tr><th>Phone visible</th><td>${lo?.addressPhoneShown?.phone ? "Yes" : "No"} ${lo?.addressPhoneShown?.phone ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'}</td></tr>
      <tr><th>Address visible</th><td>${lo?.addressPhoneShown?.address ? "Yes" : "No"} ${lo?.addressPhoneShown?.address ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'}</td></tr>
      <tr><th>Google Business link detected</th><td>${lo?.googleBusinessProfile?.detected ? "Yes" : "No"}</td></tr>
      <tr><th>Review count</th><td>${lo?.reviews?.count ?? "—"}</td></tr>
    </table>
  </div>

  <div class="card section" style="margin-top:10px;">
    <h3>Broken Links</h3>
    ${te?.brokenLinks?.ok ? `<p>No broken links found.</p>` : `
      <p>${te?.brokenLinks?.brokenCount ?? 0} broken link(s) detected.</p>
      ${(te?.brokenLinks?.brokenExamples||[]).length ? `
        <table class="table">
          <thead><tr><th style="width:28px">#</th><th>URL</th><th>Anchor Text</th><th style="width:70px">Status</th></tr></thead>
          <tbody>
            ${te.brokenLinks.brokenExamples.map((l,i)=>`
              <tr>
                <td>${i+1}</td>
                <td>${l.url}</td>
                <td>${l.anchorText ? `<em>${l.anchorText}</em>` : "<em>(No anchor text)</em>"}</td>
                <td style="color:${(l.status===404||l.status==='error')?BAD:MUTED}">${l.status}</td>
              </tr>`).join("")}
          </tbody>
        </table>` : `<p><em>(No detailed links found)</em></p>`}
    `}
    <p class="note">Broken links harm user experience and crawlability.</p>
  </div>
</section>

<!-- USABILITY -->
<section class="pb">
  <div class="section-title" style="background:${ringColor(grades?.usability?.score||0)}">Usability</div>
  <div class="card section">
    <table class="table">
      <tr><th>Viewport meta</th><td>${us?.viewport?.present ? "Present" : "Missing"} ${us?.viewport?.present ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'}</td></tr>
      <tr><th>Favicon</th><td>${us?.favicon?.present ? "Present" : "Missing"} ${us?.favicon?.present ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'}</td></tr>
      <tr><th>iFrames used</th><td>${us?.iframes?.used ? "Yes" : "No"} ${!us?.iframes?.used ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'}</td></tr>
    </table>
  </div>
</section>

<!-- PERFORMANCE -->
<section class="pb">
  <div class="section-title" style="background:${ringColor(grades?.performance?.score||0)}">Performance</div>

  <div class="card section">
    <table class="table">
      <tr><th>Download size (MB)</th><td>${pe?.downloadSizeMB ?? "—"} ${(pe?.downloadSizeMB ?? 0) <= 2 ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'}</td></tr>
      <tr><th>Resources</th><td>
        ${pe?.resourceCounts?.total ?? 0}
        (JS:${pe?.resourceCounts?.js ?? 0},
         CSS:${pe?.resourceCounts?.css ?? 0},
         IMG:${pe?.resourceCounts?.img ?? 0})
      </td></tr>
      <tr><th>Compression</th><td>${pe?.compression?.brotliOrGzip ? "Yes" : "No"} ${pe?.compression?.brotliOrGzip ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'}</td></tr>
      <tr><th>HTTP/2</th><td>${pe?.http2 ? "Yes" : "No"} ${pe?.http2 ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'}</td></tr>
      <tr><th>JS errors</th><td>${pe?.jsErrors ?? 0} ${(pe?.jsErrors ?? 0)===0 ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'}</td></tr>
    </table>
  </div>

  <div class="card section" style="margin-top:10px;">
    <h3>PageSpeed Insights / Core Web Vitals</h3>
    <div style="display:flex; justify-content:center; gap:28px; flex-wrap:wrap; margin:10px 0;">
      ${psiRing(pe?.pageSpeedInsights?.mobile?.score ?? 0, "Mobile")}
      ${psiRing(pe?.pageSpeedInsights?.desktop?.score ?? 0, "Desktop")}
    </div>

    <table class="table">
      <thead><tr><th>Metric</th><th>Mobile</th><th>Desktop</th></tr></thead>
      <tbody>
        ${(() => {
          const m = pe?.pageSpeedInsights?.mobile || {};
          const d = pe?.pageSpeedInsights?.desktop || {};
          const row = (label, mv, dv, unit="s") => `<tr><td>${label}</td><td>${mv ?? "—"}${mv!=null&&unit==="s"?" s":""}</td><td>${dv ?? "—"}${dv!=null&&unit==="s"?" s":""}</td></tr>`;
          return [
            row("Performance Score", m.score, d.score, ""),
            row("FCP", m.fcp, d.fcp),
            row("LCP", m.lcp, d.lcp),
            row("TBT", m.tbt, d.tbt),
            row("CLS", m.cls, d.cls, ""),
            row("Speed Index", m.si, d.si)
          ].join("");
        })()}
      </tbody>
    </table>
    <p class="note">Data pulled from Google PageSpeed Insights API when enabled.</p>
  </div>
</section>

<!-- SOCIAL -->
<section class="pb">
  <div class="section-title" style="background:${ringColor(grades?.social?.score||0)}">Social</div>
  <div class="card section">
    <table class="table">
      <tr><th>Open Graph</th><td>${so?.openGraph?.present ? "Present" : "Missing"} ${so?.openGraph?.present ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'}</td></tr>
      <tr><th>Twitter/X Cards</th><td>${so?.twitterCards?.present ? "Present" : "Missing"} ${so?.twitterCards?.present ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'}</td></tr>
      <tr><th>Facebook</th><td>${so?.links?.facebook || "—"}</td></tr>
      <tr><th>Instagram</th><td>${so?.links?.instagram || "—"}</td></tr>
      <tr><th>LinkedIn</th><td>${so?.links?.linkedin || "—"}</td></tr>
      <tr><th>YouTube</th><td>${so?.links?.youtube || "—"}</td></tr>
      <tr><th>Twitter (X)</th><td>${so?.links?.twitter || "—"}</td></tr>
    </table>
  </div>
</section>

<footer class="muted" style="position: fixed; bottom: 8mm; left: 0; right: 0; text-align: center; font-size:11px">
  Generated by RankMeTop • ${url}
</footer>
</body>
</html>`;
}

/* ========== Renderer ========== */
export async function renderPdf(payload){
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox","--disable-setuid-sandbox"]
  });
  try{
    const page = await browser.newPage();
    const html = htmlTemplate(payload);
    // Load Inter via Google; Chromium will fetch during render
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", bottom: "18mm", left: "14mm", right: "14mm" }
    });
    return pdf;
  } finally {
    await browser.close();
  }
}
