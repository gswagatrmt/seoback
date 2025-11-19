// ✅ correct for ESM
import * as cheerio from "cheerio";


/**
 * Extract keyword consistency info similar to HOTH-style report.
 * Looks only at visible text and checks keywords in title/meta/headings.
 */
function checkKeywordConsistency(html) {
  const $ = cheerio.load(html);

  // Remove non-visible or irrelevant elements
  $("script, style, noscript, svg, iframe, meta, link").remove();

  const visibleText = $("body").text().replace(/\s+/g, " ").trim().toLowerCase();

  const title = ($("title").text() || "").toLowerCase();
  const metaDescription = ($("meta[name='description']").attr("content") || "").toLowerCase();
  const headings = $("h1, h2, h3, h4, h5, h6")
    .map((_, el) => $(el).text())
    .get()
    .join(" ")
    .toLowerCase();

  // Basic stopword filter
  const stop = new Set([
    "the","and","to","of","in","a","is","for","on","by","with","it","this","that",
    "at","from","as","an","be","are","or","your","we","you","our","their"
  ]);

  // Tokenize words
  const words = visibleText
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !stop.has(w));

  // Single-word counts
  const wordCounts = {};
  for (const w of words) {
    wordCounts[w] = (wordCounts[w] || 0) + 1;
  }

  // Two-word phrase counts
  const phraseCounts = {};
  for (let i = 0; i < words.length - 1; i++) {
    const a = words[i], b = words[i + 1];
    if (!stop.has(a) && !stop.has(b)) {
      const phrase = `${a} ${b}`;
      phraseCounts[phrase] = (phraseCounts[phrase] || 0) + 1;
    }
  }

  // Top results
  const topWords = Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const topPhrases = Object.entries(phraseCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const keywordTable = topWords.map(([word, freq]) => ({
    keyword: word,
    inTitle: title.includes(word),
    inMeta: metaDescription.includes(word),
    inHeadings: headings.includes(word),
    frequency: freq
  }));

  const phraseTable = topPhrases.map(([phrase, freq]) => ({
    phrase,
    inTitle: title.includes(phrase),
    inMeta: metaDescription.includes(phrase),
    inHeadings: headings.includes(phrase),
    frequency: freq
  }));

  return { keywords: keywordTable, phrases: phraseTable };
}

/**
 * Main On-Page audit
 */
export async function onpage(base) {
  const { $, finalUrl, headers, html } = base;

  const title = $("title").first().text().trim();
  const metaDesc = $("meta[name='description']").attr("content")?.trim() || "";
  // Collect all H1 headings
const allH1 = $("h1")
  .map((_, el) => $(el).text().trim())
  .get()
  .filter(Boolean);

const headings = {
  h1: allH1.length,
  h2: $("h2").length,
  h3: $("h3").length,
  h4: $("h4").length,
  h5: $("h5").length,
  h6: $("h6").length,
  allH1, // store all H1s
};

  const lang = $("html").attr("lang") || "";
  const hreflang = $("link[rel='alternate'][hreflang]")
    .map((_, el) => $(el).attr("hreflang"))
    .get();
  const canonical = $("link[rel='canonical']").attr("href") || "";

  // Visible body word count (content amount)
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const words = bodyText.split(" ").filter(Boolean);
  const wordCount = words.length;

  const altMissing = $("img").filter((_, el) => !$(el).attr("alt")).length;

  // Robots/noindex
  const metaRobots = $("meta[name='robots']").attr("content")?.toLowerCase() || "";
  const headerRobots = (headers["x-robots-tag"] || "").toLowerCase();
  const noindexMeta = /noindex/i.test(metaRobots);
  const noindexHeader = /noindex/i.test(headerRobots);

  const serpPreview = { title, url: finalUrl, description: metaDesc };

  // === Keyword Consistency ===
  const keywordConsistency = checkKeywordConsistency(html || $.html());

  return {
    title: {
      value: title,
      length: title.length,
      ok: title.length >= 40 && title.length <= 60
    },
    metaDescription: {
      value: metaDesc,
      length: metaDesc.length,
      ok: metaDesc.length >= 130 && metaDesc.length <= 160
    },
    headingUsage: { h1Present: allH1.length > 0, h1Values: allH1, levels: headings },
    keywordConsistency, // <-- full keyword/phrase analysis
    contentAmount: { wordCount, thin: wordCount < 500 },
    altAttributes: { missing: altMissing },
    lang: { value: lang, present: !!lang },
    hreflang: { values: hreflang, present: hreflang.length > 0 },
    canonical: { value: canonical, present: !!canonical },
    serpPreview,
    noindex: { meta: noindexMeta, header: noindexHeader, blocked: noindexMeta || noindexHeader }
  };
}
