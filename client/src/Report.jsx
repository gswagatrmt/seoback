import HalfGauge from "./components/HalfGauge.jsx";
import FullGauge from "./components/FullGauge.jsx";
import Radar from "./components/Radar.jsx";
import Badge from "./components/Badge.jsx";
import Kpi from "./components/Kpi.jsx";
import Check from "./components/Check.jsx";
import SerpPreview from "./components/SerpPreview.jsx";
import HeadingMatrix from "./components/HeadingMatrix.jsx";
import { useState } from "react";

const Meter = ({ v }) => (
  <div className="meter">
    <div style={{ width: `${v}%` }} />
  </div>
);

function scoreColor(score) {
  const s = Number(score) || 0;
  if (s >= 90) return "#16A34A";   // Dark Green - Excellent
  if (s >= 80) return "#4ADE80";   // Light Green - Good
  if (s >= 65) return "#F59E0B";   // Yellow - Fair
  if (s >= 50) return "#F97316";   // Orange - Weak
  if (s >= 30) return "#DC2626";   // Red - Poor
  return "#B91C1C";                // Dark Red - Very Poor
}


// Dynamic section introduction generator (context-aware)
function getSectionIntro(section, score) {
  const s = score || 0;
  let heading = "";
  let paragraph = "";

  const tone = s >= 85 ? "high" : s >= 60 ? "medium" : "low";

  switch (section.toLowerCase()) {
    case "on-page seo":
      if (tone === "high") {
        heading = "Your On-Page SEO is strong but can be refined further";
        paragraph = `Your page demonstrates solid On-Page SEO fundamentals. Key tags, headings, and content length appear well-structured.
Even with this performance, consider periodically reviewing title and meta tag precision, keyword balance, and page hierarchy 
to maintain and strengthen ranking stability over time.`;
      } else if (tone === "medium") {
        heading = "Your On-Page SEO could be better";
        paragraph = `The page has a fair level of On-Page optimization but several components still need improvement.
Optimizing titles, meta tags, headings, and textual relevance can help search engines interpret the content with more clarity 
and support higher visibility across relevant keywords.`;
      } else {
        heading = "Your On-Page SEO requires significant improvement";
        paragraph = `Key On-Page SEO components are missing or poorly configured. Title tags, meta descriptions, and 
headings may not be aligned to your content intent. Addressing these issues can dramatically improve indexing quality, 
keyword recognition, and user engagement from search results.`;
      }
      break;

    case "usability":
      if (tone === "high") {
        heading = "Your site’s usability is well-optimized";
        paragraph = `The site delivers a consistent experience across devices with proper viewport configuration and user-focused design.
To improve more, test accessibility elements and ensure interactive areas are touch-friendly on all screen sizes.`;
      } else if (tone === "medium") {
        heading = "Your site’s usability is fair but can improve";
        paragraph = `Your site performs decently in terms of usability, though small issues may reduce comfort on mobile devices.
Improving font readability, tap target sizing, and navigation simplicity will enhance the browsing experience.`;
      } else {
        heading = "Your site’s usability needs major attention";
        paragraph = `Usability problems may hinder visitors from easily navigating your site.
Missing viewport settings, layout inconsistencies, or unoptimized mobile behavior can lead to frustration and higher bounce rates.
Fixing these areas will improve engagement and retention.`;
      }
      break;

    case "performance":
      if (tone === "high") {
        heading = "Your website performance is excellent";
        paragraph = `Your site loads efficiently with minimal overhead and optimized assets.
Keep monitoring file sizes, caching policies, and JavaScript execution time to maintain peak performance levels.`;
      } else if (tone === "medium") {
        heading = "Your website performance can be optimized";
        paragraph = `Your site performs moderately well but gains remain on the table.
Review image compression, script loading order, and caching strategies to improve speed and responsiveness.`;
      } else {
        heading = "Your website performance is below expectations";
        paragraph = `Your site’s loading speed and transfer size may be slowing users.
Uncompressed assets, heavy scripts, or missing caching directives hurt ranking and experience. Reduce weight and optimize delivery.`;
      }
      break;

    case "social":
      if (tone === "high") {
        heading = "Your social presence is healthy";
        paragraph = `Your site includes appropriate social metadata and links to key profiles.
Active publishing and consistent metadata keep brand signals clear across platforms.`;
      } else if (tone === "medium") {
        heading = "Your social visibility could be improved";
        paragraph = `Your site contains some social metadata or external links, but coverage is incomplete.
Add Open Graph, Twitter Cards, and link the major profiles to improve previews and authority.`;
      } else {
        heading = "Your social integration is lacking";
        paragraph = `Limited social signals detected. Missing Open Graph or Twitter metadata blocks quality link previews.
Add metadata and visible profile links to strengthen brand perception.`;
      }
      break;

    case "technical":
    case "technical & local":
      if (tone === "high") {
        heading = "Your technical and local setup is well-configured";
        paragraph = `Your website shows a good foundation with SSL, HTTPS redirection, and structured data implemented.
Keep sitemaps, robots.txt, and analytics integrations accurate and active.`;
      } else if (tone === "medium") {
        heading = "Your technical setup can be improved";
        paragraph = `Your site covers several technical basics but lacks consistency in a few areas.
Ensure HTTPS enforcement, schema completeness, and a working sitemap for clean crawling and indexing.`;
      } else {
        heading = "Your technical foundation needs a deeper review";
        paragraph = `Several core technical SEO factors are missing or misconfigured.
Missing HTTPS, sitemaps, or structured data can restrict visibility. Fixing these issues improves indexability and stability.`;
      }
      break;

    default:
      heading = `Your ${section} score`;
      paragraph = `No specific description found for this section.`;
  }

  return { heading, paragraph, tone };
}

export default function Report({ data }) {
  const { meta, grades, sections } = data;
  const [serpOverride, setSerpOverride] = useState({});

  const radarScores = {
    onpage: grades.onpage?.score ?? 0,
    techlocal: grades.techlocal?.score ?? 0,
    performance: grades.performance?.score ?? 0,
    social: grades.social?.score ?? 0,
  };

  const row = (label, value, ok) => (
    <tr key={label}>
      <th>{label}</th>
      <td>
        {value} {ok !== undefined && <Check ok={ok} />}
      </td>
    </tr>
  );

  const on = sections.onpage;
  const pe = sections.performance;
  const so = sections.social;
  const te = sections.tech;
  const lo = sections.local;

  const perfOk = {
    size: pe.downloadSizeMB <= 2,
    compression: !!pe.compression?.brotliOrGzip,
    http2: !!pe.http2,
    jsErrors: (pe.jsErrors || 0) === 0,
  };

  /* ===== Responsive helpers (flex-first, auto-wrap) ===== */
  const flexWrapRow = {
    display: "flex",
    flexWrap: "wrap",
    gap: 16,
    alignItems: "stretch",
  };
  const cardCol = (basis = 300, grow = 1) => ({
    flex: `1 1 ${basis}px`,
    minWidth: basis,
  });
  const centerRow = {
    display: "flex",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap"
  };
  const tableWrap = { width: "100%", overflowX: "auto" };

  return (
    <>
      {/* ===== Top summary (flex, auto-wrap, balanced) ===== */}
<div className="audit-summary-container">
  {/* === Audit Results Card === */}
  <div className="card">
    <div style={centerRow}>
      <h2>
        Audit Results: <span className="mono">{meta.url}</span>
      </h2>
    </div>

    <div
      style={{
        ...centerRow,
        justifyContent: "center",
        flexWrap: "wrap",
        marginTop: 10,
        gap: 20,
      }}
    >
      <div style={{ flex: "0 0 auto" }}>
        <FullGauge
          score={grades.overall.score}
          letter={grades.overall.letter}
          label="Overall"
          size={140}
        />
      </div>
  <div className="gauge-container">
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          gap: 12,
          width: "100%",
        }}
      >
        <FullGauge
          score={grades.onpage.score}
          letter={grades.onpage.letter}
          label="On-Page SEO"
          size={100}
        />
        <FullGauge
          score={grades.techlocal.score}
          letter={grades.techlocal.letter}
          label="Technical SEO"
          size={100}
        />
        <FullGauge
          score={grades.performance.score}
          letter={grades.performance.letter}
          label="Performance"
          size={100}
        />
        <FullGauge
          score={grades.social.score}
          letter={grades.social.letter}
          label="Social"
          size={100}
        />
      </div>
    </div>
</div>
    <div className="label" style={{ marginTop: 16 }}>
      Fetched: {new Date(meta.fetchedAt).toLocaleString()}
    </div>
  </div>


  {/* === Coverage Card (same visual balance) === */}
  <div className="card">
    <div style={{ ...centerRow, justifyContent: "center" }}>
      <h2>Coverage</h2>
    </div>

    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexWrap: "wrap",
        marginTop: 40,
        width: "100%",
      }}
    >
      <Radar scores={radarScores} />
    </div>
  </div>
</div>

      {/* ===== Device Rendering View (balanced & fixed) ===== */}
      <div className="card">
        <h2>Device Preview</h2>

        <div
          style={{
            ...flexWrapRow,
            justifyContent: "center",
            gap: 20,
            alignItems: "flex-start",
            marginTop: 12,
            flexWrap: "wrap",
          }}
        >
          {/* Mobile */}
          <div
            style={{
              flex: "1 1 250px",
              maxWidth: "100%",//  keep compact width
              width: "100%",
              textAlign: "center",
              boxSizing: "border-box",
              padding: "0 8px",
            }}
          >
            <h4 style={{ marginBottom: 8, color: "#374151" }}>Mobile View</h4>
            <div 
              style={{
                width: "100%",
                height: "auto",
                aspectRatio: "9 / 16", // ✅ realistic phone ratio
                border: "7px solid #111827",
                borderRadius: "28px",
                overflow: "hidden",
                boxShadow: "0 3px 8px rgba(0,0,0,0.25)",
                background: "#000",
                display: "flex",
                justifyContent: "center",
                alignItems: "flex-start",
                margin: "0 auto",
                maxHeight:"380px",
                maxWidth: "205px",     // ✅ ensures it never looks oversized
              }}
            >
              {meta.screenshotMobile ? (
                <img
                  src={meta.screenshotMobile}
                  alt="Mobile rendering"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: "top",
                    display: "block"
                  }}
                />
              ) : (
                <div style={{ color: "#9CA3AF", paddingTop: "40%" }}>
                  Mobile preview unavailable
                </div>
              )}
            </div>
          </div>

          {/* Desktop */}
          <div
            style={{
              flex: "1 1 480px",
              minWidth: "250px",
              maxWidth: "100%",
              textAlign: "center",
              boxSizing: "border-box",
              padding: "0 8px",
            }}
          >
            <h4 style={{ marginBottom: 8, color: "#374151" }}>Desktop View</h4>
            <div
              style={{
                width: "100%",
                height: "auto",
                border: "6px solid #111827",
                borderRadius: 10,
                overflow: "hidden",
                background: "#000",
                boxShadow: "0 3px 8px rgba(0,0,0,0.25)",
                display: "flex",
                justifyContent: "center",
                alignItems: "flex-start",
                margin: "0 auto",
                aspectRatio: "16 / 9",
              }}
            >
              {meta.screenshotDesktop ? (
                <img
                  src={meta.screenshotDesktop}
                  alt="Desktop rendering"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: "top",
                    display: "block",
                  }}
                />
              ) : (
                <div style={{ color: "#9CA3AF", paddingTop: "20%" }}>
                  Desktop preview unavailable
                </div>
              )}
            </div>
          </div>
        </div>
      </div>



      {/* ===== SERP preview ===== */}
      <div className="card">
        <h2>SERP Snippet Preview</h2>
        <SerpPreview
          url={sections.onpage.serpPreview.url}
          title={sections.onpage.serpPreview.title}
          description={sections.onpage.serpPreview.description}
          favicon={sections.onpage.favicon?.url}
        />
      </div>

      {/* ===== On-Page SEO ===== */}
      <div className="card">
        <div
          className="section-title"
          style={{ background: scoreColor(grades.onpage.score) }}
        >
          On-Page SEO Results
        </div>

       <div class="center-row" style={{ ...centerRow, marginBottom: 12 }}>
          {(() => {
            const intro = getSectionIntro("On-Page SEO", grades.onpage.score);
            return (
              <div
                className={`section-intro tone-${intro.tone}`}
                style={{ ...centerRow }}
              >
                <FullGauge
                  score={grades.onpage.score}
                  letter={grades.onpage.letter}
                  label=""
                  size={140}
                />
                <div style={{ minWidth: 240, flex: "1 1 280px" }}>
                  <h3>{intro.heading}</h3>
                  <p
                    style={{
                      fontSize: 14,
                      color: "#4b5563",
                      lineHeight: 1.55,
                      whiteSpace: "pre-line",
                    }}
                  >
                    {intro.paragraph}
                  </p>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Title */}
        <div className="element-block">
          <div className="element-header">
            <strong>Title Tag</strong>
            <Check ok={on.title.ok} />
          </div>
          <p>
            You have a Title Tag, ideally it should be between 50 and 60
            characters in length (including spaces).
          </p>
          <p>
            <em>{on.title.value || "(No title found)"}</em>
          </p>
          <p>Length: {on.title.length}</p>
          <p className="note">
            Title Tags help search engines understand and categorize your content.
          </p>
        </div>

        {/* Meta Description */}
        <div className="element-block">
          <div className="element-header">
            <strong>Meta Description</strong>
            <Check ok={on.metaDescription.ok} />
          </div>
          <p>
            {on.metaDescription.ok
              ? "Your page has a Meta Description of optimal length (between 120 and 160 characters)."
              : "Your page’s Meta Description is missing or not within the recommended 120–160 character range."}
          </p>
          <p>
            <em>{on.metaDescription.value || "(No description found)"}</em>
          </p>
          <p>Length: {on.metaDescription.length}</p>
          <p className="note">
            Meta Descriptions guide users and improve click-through rates.
          </p>
        </div>

        {/* H1 */}
        <div className="element-block">
          <div className="element-header">
            <strong>H1 Tag</strong>

            {(() => {
              const hasSingleH1 = on.headingUsage.levels.h1 === 1;

              return <Check ok={hasSingleH1} />;
            })()}
          </div>
          <p>
            {on.headingUsage.levels.h1 === 0
              ? "No H1 heading found on the page. Every page should have one main H1 header."
              : on.headingUsage.levels.h1 === 1
                ? "Your page includes a main H1 heading."
                : "Multiple H1 headings found on the page. Every page should have one main H1 header."}
          </p>

          {on.headingUsage.h1Values && on.headingUsage.h1Values.length > 0 ? (
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "6px" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "4px 0", color: "#6B7280", fontSize: "13px" }}>#</th>
                  <th style={{ textAlign: "left", padding: "4px 0", color: "#6B7280", fontSize: "13px" }}>H1 Text</th>
                </tr>
              </thead>
              <tbody>
                {on.headingUsage.h1Values.map((text, i) => (
                  <tr key={i}>
                    <td style={{ padding: "4px 0", width: "32px", color: "#9CA3AF", fontSize: "13px" }}>{i + 1}</td>
                    <td style={{ padding: "4px 0", fontSize: "14px", color: "#111827" }}>
                      <em>{text}</em>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p><em>(No H1 content found)</em></p>
          )}

          <p>H1 count: {on.headingUsage.levels.h1}</p>
          <p className="note">
            Use a single H1 to define the main topic of the page.
          </p>
        </div>

        {/* H2–H6 */}
        <div className="element-block">
          <div className="element-header">
            <strong>H2–H6 Headings</strong>
            {(() => {
              const hasGoodHeadings =
                on.headingUsage.levels.h2 > 0 && on.headingUsage.levels.h3 > 0;
              return <Check ok={hasGoodHeadings} />;
            })()}
          </div>
          <p>
            {on.headingUsage.levels.h2 > 0 && on.headingUsage.levels.h3 > 0
              ? "Your page includes both H2 and H3 subheadings, forming solid structure."
              : "Either H2 or H3 headings are missing. Add both to improve hierarchy and clarity."}
          </p>

          <div style={tableWrap}>
            <table className="table" style={{ minWidth: 420, textAlign: "center" }}>
              <thead>
                <tr>
                  <th>H2</th>
                  <th>H3</th>
                  <th>H4</th>
                  <th>H5</th>
                  <th>H6</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{on.headingUsage.levels.h2}</td>
                  <td>{on.headingUsage.levels.h3}</td>
                  <td>{on.headingUsage.levels.h4}</td>
                  <td>{on.headingUsage.levels.h5}</td>
                  <td>{on.headingUsage.levels.h6}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="note">
            Subheadings improve readability and help search engines parse content structure.
          </p>
        </div>

        {/* Word Count */}
        <div className="element-block">
          <div className="element-header">
            <strong>Content Length</strong>
            <Check ok={!on.contentAmount.thin} />
          </div>
          <p>
            {on.contentAmount.thin
              ? "Low readable content may be seen as thin content."
              : "Content length looks sufficient for evaluation."}
          </p>
          <p>Word Count: {on.contentAmount.wordCount}</p>
          <p className="note">
            Aim for depth and relevance, not just length.
          </p>
        </div>

        {/* ALT */}
        <div className="element-block">
          <div className="element-header">
            <strong>Image ALT Attributes</strong>
            <Check ok={on.altAttributes.missing === 0} />
          </div>
          <p>
            {on.altAttributes.missing === 0
              ? "All images include ALT attributes."
              : `${on.altAttributes.missing} image(s) are missing ALT attributes.`}
          </p>
          <p className="note">
            ALT text improves accessibility and image SEO.
          </p>
        </div>

        {/* Lang */}
        <div className="element-block">
          <div className="element-header">
            <strong>Language Attribute</strong>
            <Check ok={!!on.lang.value} />
          </div>
          <p>
            {on.lang.value
              ? `Declared language: ${on.lang.value}`
              : "No language declared in the HTML tag."}
          </p>
          <p className="note">
            The “lang” attribute helps deliver localized results.
          </p>
        </div>
      </div>

      {/* ===== Keyword Consistency ===== */}
      <div className="card">
        <h3>Keyword Consistency</h3>

        {/* === Keywords Table === */}
        <div className="table-wrapper">
          <table className="table keyword-consistency" style={{ minWidth: "540px" }}>
            <thead>
              <tr>
                <th>Keyword</th>
                <th>Title</th>
                <th>Meta Description</th>
                <th>Headings</th>
                <th>Frequency</th>
              </tr>
            </thead>
            <tbody>
              {sections.onpage.keywordConsistency.keywords.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: "center", color: "#9CA3AF" }}>
                    No keywords found.
                  </td>
                </tr>
              ) : (
                sections.onpage.keywordConsistency.keywords.map((k) => (
                  <tr key={k.keyword}>
                    <td style={{ textTransform: "capitalize" }}>{k.keyword}</td>
                    <td><Check ok={k.inTitle} /></td>
                    <td><Check ok={k.inMeta} /></td>
                    <td><Check ok={k.inHeadings} /></td>
                    <td>{k.frequency}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* === Phrases Table === */}
        {sections.onpage.keywordConsistency.phrases &&
          sections.onpage.keywordConsistency.phrases.length > 0 && (
            <>
              <h4 style={{ marginTop: "20px" }}>Two-Word Phrases</h4>
              <div className="table-wrapper">
                <table className="table keyword-consistency" style={{ minWidth: "540px" }}>
                  <thead>
                    <tr>
                      <th>Phrase</th>
                      <th>Title</th>
                      <th>Meta Description</th>
                      <th>Headings</th>
                      <th>Frequency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sections.onpage.keywordConsistency.phrases.map((p) => (
                      <tr key={p.phrase}>
                        <td style={{ textTransform: "capitalize" }}>{p.phrase}</td>
                        <td><Check ok={p.inTitle} /></td>
                        <td><Check ok={p.inMeta} /></td>
                        <td><Check ok={p.inHeadings} /></td>
                        <td>{p.frequency}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
      </div>
      {/* ===== Technical & Local ===== */}
      <div className="card">
        <div
          className="section-title"
          style={{ background: scoreColor(grades.techlocal.score) }}
        >
          Technical SEO Results
        </div>

       <div class="center-row" style={{ ...centerRow, marginBottom: 12 }}>
          {(() => {
            const intro = getSectionIntro("Technical & Local", grades.techlocal.score);
            return (
              <div className={`section-intro tone-${intro.tone}`} style={centerRow}>
                <FullGauge
                  score={grades.techlocal.score}
                  letter={grades.techlocal.letter}
                  label=" "
                  size={140}
                />
                <div style={{ minWidth: 240, flex: "1 1 280px" }}>
                  <h3>{intro.heading}</h3>
                  <p
                    style={{
                      fontSize: 14,
                      color: "#4b5563",
                      lineHeight: 1.55,
                      whiteSpace: "pre-line",
                    }}
                  >
                    {intro.paragraph}
                  </p>
                </div>
              </div>
            );
          })()}
        </div>

        {/* SSL */}
        <div className="element-block">
          <div className="element-header">
            <strong>SSL</strong>
            <Check ok={te.ssl.enabled} />
          </div>
          <p>{te.ssl.enabled ? "SSL enabled." : "SSL not detected."}</p>
          <p className="note">HTTPS is a ranking and trust signal.</p>
        </div>

        {/* HTTPS Redirect */}
        <div className="element-block">
          <div className="element-header">
            <strong>HTTPS Redirect</strong>
            <Check ok={te.httpsRedirect.ok} />
          </div>
          <p>
            {te.httpsRedirect.ok ? "Redirect to HTTPS works." : "No redirect to HTTPS found."}
          </p>
          <p className="note">Enforce secure access for users and crawlers.</p>
        </div>

        {/* Noindex Detection */}
        <div className="element-block">
          <div className="element-header">
            <strong>Noindex</strong>
            <Check ok={!te.noindex.present} />
          </div>
          {te.noindex.present ? (
            <p>
              {te.noindex.header && te.noindex.meta && (
                <>Both header and meta noindex found.</>
              )}
              {te.noindex.header && !te.noindex.meta && (
                <>Header noindex directive detected.</>
              )}
              {!te.noindex.header && te.noindex.meta && (
                <>Meta noindex tag detected in HTML head.</>
              )}
            </p>
          ) : (
            <p>No noindex directives detected. This page is indexable.</p>
          )}<p className="note">
            Use noindex only for pages you don’t want search engines to index.
          </p>

        </div>

        {/* Canonical */}
        <div className="element-block">
          <div className="element-header">
            <strong>Canonical Tag</strong>
            <Check ok={on.canonical.present} />
          </div>
          <p>
            {on.canonical.present
              ? "Canonical URL specified."
              : "No canonical tag detected. Define the preferred URL."}
          </p>
          <p>
            <em>{on.canonical.value || "(No canonical URL)"}</em>
          </p>
          <p className="note">
            Canonicals prevent duplicate content issues.
          </p>
        </div>

{/* Broken Links */}
  {/* Broken Links */}
<div className="element-block">
  <div className="element-header">
    <strong>Broken Links</strong>
    <Check ok={te.brokenLinks.ok} />
  </div>

  <p>
    {te.brokenLinks.ok
      ? "No broken links found."
      : `${te.brokenLinks.brokenCount} broken link(s) detected.`}
  </p>

  {!te.brokenLinks.ok && te.brokenLinks.brokenExamples.length > 0 ? (
    <div
      style={{
        width: "100%",
        overflowX: "auto", // ✅ makes table scrollable on small screens
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginTop: "6px",
          tableLayout: "auto", // ✅ allows flexible column widths
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                textAlign: "left",
                padding: "4px 6px",
                color: "#6B7280",
                fontSize: "13px",
                width: "28px",
              }}
            >
              #
            </th>
            <th
              style={{
                textAlign: "left",
                padding: "4px 6px",
                color: "#6B7280",
                fontSize: "13px",
                minWidth: "140px",
              }}
            >
              URL
            </th>
            <th
              style={{
                textAlign: "left",
                padding: "4px 6px",
                color: "#6B7280",
                fontSize: "13px",
                minWidth: "120px",
              }}
            >
              Anchor Text
            </th>
            <th
              style={{
                textAlign: "left",
                padding: "4px 6px",
                color: "#6B7280",
                fontSize: "13px",
                width: "70px",
              }}
            >
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {te.brokenLinks.brokenExamples.map((l, i) => (
            <tr key={l.url}>
              <td
                style={{
                  padding: "4px 6px",
                  color: "#9CA3AF",
                  fontSize: "13px",
                  whiteSpace: "nowrap",
                }}
              >
                {i + 1}
              </td>
              <td
                style={{
                  padding: "4px 6px",
                  fontSize: "14px",
                  color: "#111827",
                  wordBreak: "break-word", // ✅ wrap long URLs
                }}
              >
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#2563EB", textDecoration: "none" }}
                >
                  {l.url}
                </a>
              </td>
              <td
                style={{
                  padding: "4px 6px",
                  fontSize: "14px",
                  color: "#111827",
                  wordBreak: "break-word",
                }}
              >
                {l.anchorText ? (
                  <em>{l.anchorText}</em>
                ) : (
                  <em>(No anchor text)</em>
                )}
              </td>
              <td
                style={{
                  padding: "4px 6px",
                  fontSize: "14px",
                  color:
                    l.status === 404 || l.status === "error"
                      ? "#DC2626"
                      : "#6B7280",
                  whiteSpace: "nowrap",
                }}
              >
                {l.status}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    !te.brokenLinks.ok && <p><em>(No detailed links found)</em></p>
  )}

  <p className="note">
    Broken links harm user experience and crawlability.
  </p>
</div>


        {/* robots.txt */}
        <div className="element-block">
          <div className="element-header">
            <strong>robots.txt</strong>
            <Check ok={te.robots.present && te.robots.optimized} />
          </div>

          {te.robots.present ? (
            te.robots.optimized ? (
              <p>
                robots.txt detected at{" "}
                <a
                  href={te.robots.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#2563eb", textDecoration: "none" }}
                >
                  {te.robots.url}
                </a>{" "}
                and contains valid directives or a sitemap entry.
              </p>
            ) : (
              <p>
                robots.txt found but needs optimization — missing{" "}
                <code>User-agent</code>, <code>Disallow</code>, or <code>Sitemap</code>.
              </p>
            )
          ) : (
            <p>
              {te.robots.status === 404
                ? "robots.txt returned 404."
                : "No robots.txt found or not accessible."}
            </p>
          )}

          <p className="note">
            Define crawler access and include a Sitemap line when possible.
          </p>
        </div>

        {/* sitemap.xml */}
        <div className="element-block">
          <div className="element-header">
            <strong>sitemap.xml</strong>
            <Check ok={te.sitemap.present && te.sitemap.optimized} />
          </div>

          {te.sitemap.present ? (
            te.sitemap.optimized ? (
              <p>
                Sitemap found:{" "}
                <a
                  href={te.sitemap.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#2563eb", textDecoration: "none" }}
                >
                  {te.sitemap.url}
                </a>{" "}
                ({te.sitemap.urlCount} URLs)
              </p>
            ) : (
              <p>Sitemap detected but no valid URLs were found.</p>
            )
          ) : (
            <p>
              {te.sitemap.status === 404
                ? "Sitemap returned 404."
                : "No sitemap.xml detected or not accessible."}
            </p>
          )}

          <p className="note">A good sitemap speeds up crawling.</p>
        </div>

        {/* schema.org */}
        <div className="element-block">
          <div className="element-header">
            <strong>Schema.org Structured Data</strong>
            <Check ok={te.schemaOrg.present} />
          </div>
         
           {te.schemaOrg.present ? (
  te.schemaOrg.optimised ? (
    <p>
      Schema.org structured data found and optimized on the site.
    </p>
  ) : (
    <p>
      Schema.org structured data found but needs optimization.
    </p>
  )
) : (
  <p>
    No Schema.org structured data detected.
  </p>
)}
          <p className="note">
            Structured data helps search engines better understand your business information.
          </p>
        </div>

        

        <div className="element-block">
          <div className="element-header">
            <strong>Favicon</strong>
           <Check ok={te.favicon.present} />
          </div>
          <p>{te.favicon.present ? "Favicon detected." : "No favicon detected."}</p>
          <p className="note">Favicons aid recognition in tabs and SERP.</p>
        </div>

        <div className="element-block">
          <div className="element-header">
            <strong>Viewport Meta Tag</strong>
            <Check ok={te.viewport.present} />
          </div>
          <p>
            {te.viewport.present
              ? "Responsive viewport detected."
              : "No viewport meta tag found."}
          </p>
          <p className="note">
            The viewport tag lets browsers render correctly on different screens.
          </p>
        </div>
      </div>

      {/* ===== Performance ===== */}
      <div className="card">
        <div
          className="section-title"
          style={{ background: scoreColor(grades.performance.score) }}
        >
          Performance Results
        </div>

       <div class="center-row" style={{ ...centerRow, marginBottom: 12 }}>
          {(() => {
            const intro = getSectionIntro("Performance", grades.performance.score);
            return (
              <div className={`section-intro tone-${intro.tone}`} style={centerRow}>
                <FullGauge
                  score={grades.performance.score}
                  letter={grades.performance.letter}
                  label=" "
                  size={140}
                />
                <div style={{ minWidth: 240, flex: "1 1 280px" }}>
                  <h3>{intro.heading}</h3>
                  <p
                    style={{
                      fontSize: 14,
                      color: "#4b5563",
                      lineHeight: 1.55,
                      whiteSpace: "pre-line",
                    }}
                  >
                    {intro.paragraph}
                  </p>
                </div>
              </div>
            );
          })()}
        </div>

        <div className="element-block">
          <div className="element-header">
            <strong>Download Size</strong>
            <Check ok={pe.downloadSizeMB <= 2} />
          </div>
          <p>Total download size: {pe.downloadSizeMB} MB</p>
          <p className="note">
            Keep total page size under ~2 MB for fast loads.
          </p>
        </div>

        <div className="element-block">
          <div className="element-header">
            <strong>Compression</strong>
            <Check ok={pe.compression.brotliOrGzip} />
          </div>
          <p>
            {pe.compression.brotliOrGzip
              ? "Brotli/Gzip detected."
              : "No compression detected."}
          </p>
          <p className="note">
            Server compression reduces transfer size and speeds up response.
          </p>
        </div>

        <div className="element-block">
          <div className="element-header">
            <strong>HTTP/2</strong>
            <Check ok={pe.http2} />
          </div>
          <p>{pe.http2 ? "HTTP/2 enabled." : "HTTP/2 not detected."}</p>
          <p className="note">HTTP/2 improves multiplexing and latency.</p>
        </div>

        {pe.pageSpeedInsights && (
          <div className="element-block">
            <div className="element-header">
              <strong>PageSpeed Insights (PSI & Core Web Vitals)</strong>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 40,
                flexWrap: "wrap",
                margin: "20px 0",
              }}
            >
              {["mobile", "desktop"].map((type) => {
                const data = pe.pageSpeedInsights?.[type];
                const score = data?.score ?? 0;
                const color =
                  score >= 90 ? "#16A34A" : score >= 50 ? "#F59E0B" : "#DC2626";
                const radius = 50;
                const circumference = 2 * Math.PI * radius;
                const dash = ((100 - score) / 100) * circumference;

                return (
                  <svg
                    key={type}
                    width="160"
                    height="160"
                    viewBox="0 0 160 160"
                    role="img"
                    aria-label={`${type} PSI score ${score}`}
                  >
                    <circle
                      cx="80"
                      cy="80"
                      r={radius}
                      fill="none"
                      stroke="#E5E7EB"
                      strokeWidth="12"
                    />
                    <circle
                      cx="80"
                      cy="80"
                      r={radius}
                      fill="none"
                      stroke={color}
                      strokeWidth="12"
                      strokeDasharray={circumference}
                      strokeDashoffset={dash}
                      strokeLinecap="round"
                      transform="rotate(-90 80 80)"
                    />
                    <text
                      x="50%"
                      y="52%"
                      textAnchor="middle"
                      fontSize="32"
                      fontWeight="700"
                      fill={color}
                    >
                      {score}
                    </text>
                    <text
                      x="50%"
                      y="70%"
                      textAnchor="middle"
                      fontSize="13"
                      fill="#6B7280"
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </text>
                  </svg>
                );
              })}
            </div>

            {/* Core Web Vitals Table */}
            <div style={tableWrap}>
              <table className="table" style={{ minWidth: 540 }}>
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Mobile</th>
                    <th>Desktop</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const m = pe.pageSpeedInsights.mobile || {};
                    const d = pe.pageSpeedInsights.desktop || {};

                    const color = (metric, value) => {
                      if (value == null) return "#6B7280";
                      const v = Number(value);
                      switch (metric) {
                        case "fcp":
                          return v <= 1.8 ? "#16A34A" : v <= 3 ? "#F59E0B" : "#DC2626";
                        case "lcp":
                          return v <= 2.5 ? "#16A34A" : v <= 4 ? "#F59E0B" : "#DC2626";
                        case "tbt":
                          return v <= 0.2 ? "#16A34A" : v <= 0.6 ? "#F59E0B" : "#DC2626";
                        case "cls":
                          return v <= 0.1 ? "#16A34A" : v <= 0.25 ? "#F59E0B" : "#DC2626";
                        case "si":
                          return v <= 3.4 ? "#16A34A" : v <= 5.8 ? "#F59E0B" : "#DC2626";
                        case "score":
                          return v >= 90 ? "#16A34A" : v >= 50 ? "#F59E0B" : "#DC2626";
                        default:
                          return "#6B7280";
                      }
                    };

                    const format = (v, unit = "s") =>
                      v == null ? "—" : `${v}${unit === "s" ? " s" : ""}`;

                    return (
                      <>
                        <tr>
                          <td>Performance Score</td>
                          <td style={{ color: color("score", m.score), fontWeight: 700 }}>
                            {m.score ?? "—"}
                          </td>
                          <td style={{ color: color("score", d.score), fontWeight: 700 }}>
                            {d.score ?? "—"}
                          </td>
                        </tr>
                        <tr>
                          <td>FCP (s)</td>
                          <td style={{ color: color("fcp", m.fcp) }}>
                            {format(m.fcp)}
                          </td>
                          <td style={{ color: color("fcp", d.fcp) }}>
                            {format(d.fcp)}
                          </td>
                        </tr>
                        <tr>
                          <td>LCP (s)</td>
                          <td style={{ color: color("lcp", m.lcp) }}>
                            {format(m.lcp)}
                          </td>
                          <td style={{ color: color("lcp", d.lcp) }}>
                            {format(d.lcp)}
                          </td>
                        </tr>
                        <tr>
                          <td>TBT (s)</td>
                          <td style={{ color: color("tbt", m.tbt) }}>
                            {format(m.tbt)}
                          </td>
                          <td style={{ color: color("tbt", d.tbt) }}>
                            {format(d.tbt)}
                          </td>
                        </tr>
                        <tr>
                          <td>CLS</td>
                          <td style={{ color: color("cls", m.cls) }}>
                            {m.cls ?? "—"}
                          </td>
                          <td style={{ color: color("cls", d.cls) }}>
                            {d.cls ?? "—"}
                          </td>
                        </tr>
                        <tr>
                          <td>Speed Index (s)</td>
                          <td style={{ color: color("si", m.si) }}>
                            {format(m.si)}
                          </td>
                          <td style={{ color: color("si", d.si) }}>
                            {format(d.si)}
                          </td>
                        </tr>
                      </>
                    );
                  })()}
                </tbody>
              </table>
            </div>

            <p className="note">Data fetched from Google PageSpeed Insights API.</p>
          </div>
        )}
      </div>

      {/* ===== Social ===== */}
      <div className="card">
        <div
          className="section-title"
          style={{ background: scoreColor(grades.social.score) }}
        >
          Social Results
        </div>

       <div class="center-row" style={{ ...centerRow, marginBottom: 12 }}>
          {(() => {
            const intro = getSectionIntro("Social", grades.social.score);
            return (
              <div className={`section-intro tone-${intro.tone}`} style={centerRow}>
                <FullGauge
                  score={grades.social.score}
                  letter={grades.social.letter}
                  label=""
                  size={140}
                />
                <div style={{ minWidth: 240, flex: "1 1 280px" }}>
                  <h3>{intro.heading}</h3>
                  <p
                    style={{
                      fontSize: 14,
                      color: "#4b5563",
                      lineHeight: 1.55,
                      whiteSpace: "pre-line",
                    }}
                  >
                    {intro.paragraph}
                  </p>
                </div>
              </div>
            );
          })()}
        </div>

        <div className="element-block">
          <div className="element-header">
            <strong>Open Graph Tags</strong>
            <Check ok={so.openGraph.present} />
          </div>
          <p>
            {so.openGraph.present
              ? "Open Graph tags detected."
              : "No Open Graph tags found."}
          </p>
          <p className="note">
            Open Graph controls title, description, and image on share.
          </p>
        </div>

        <div className="element-block">
          <div className="element-header">
            <strong>Twitter/X Cards</strong>
            <Check ok={so.twitterCards.present} />
          </div>
          <p>{so.twitterCards.present ? "Twitter Card present." : "No Twitter Card metadata."}</p>
          <p className="note">Cards improve preview quality on X/Twitter.</p>
        </div>

        <div className="element-block">
          <div className="element-header">
            <strong>Linked Social Profiles</strong>
            <Check
              ok={
                so.links.facebook ||
                so.links.instagram ||
                so.links.linkedin ||
                so.links.youtube ||
                so.links.twitter
              }
            />
          </div>
          <p>
            Facebook: {so.links.facebook || "—"}
            <br />
            Instagram: {so.links.instagram || "—"}
            <br />
            LinkedIn: {so.links.linkedin || "—"}
            <br />
            YouTube: {so.links.youtube || "—"}
            <br />
            Twitter (X): {so.links.twitter || "—"} {/* ✅ new line */}
          </p>

          <p className="note">
            Visible profile links help connect brand signals.
          </p>
        </div>
      </div>


    </>
  );
}
