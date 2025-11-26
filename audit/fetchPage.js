import got from "got";
import * as cheerio from "cheerio";
import iconv from "iconv-lite";
import UserAgent from "user-agents";
import mime from "mime-types";

// Cache to store the results of previous fetches (in-memory)
const fetchCache = new Map();

export async function fetchPage(inputUrl) {
  const u = inputUrl.startsWith("http") ? inputUrl : `https://${inputUrl}`;
  
  // Check if the URL is already in the cache
  if (fetchCache.has(u)) {
    console.log(`[fetchPage] Cache hit for: ${u}`);
    return fetchCache.get(u);
  }

  const ua = new UserAgent().toString();
  const t0 = Date.now();

  let resp;
  try {
    // First attempt with normal SSL verification
    resp = await got(u, {
      throwHttpErrors: false,
      decompress: true,
      headers: {
        "user-agent": ua,
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9"
      },
      timeout: { request: 20000 },
      followRedirect: true,
      responseType: "buffer",
    });
  } catch (err) {
    // SSL verification failed — log it and retry with relaxed SSL
    if (err.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" || err.message.includes("unable to get local issuer certificate")) {
      console.warn(`⚠️ [fetchPage] SSL verification failed for ${u} (${err.message}). Retrying without certificate validation...`);
      try {
        resp = await got(u, {
          throwHttpErrors: false,
          decompress: true,
          headers: {
            "user-agent": ua,
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "accept-language": "en-US,en;q=0.9"
          },
          timeout: { request: 20000 },
          followRedirect: true,
          responseType: "buffer",
          https: { rejectUnauthorized: false }, // allow invalid certs
        });
      } catch (e2) {
        console.error(`❌ [fetchPage] Retry failed for ${u}: ${e2.message}`);
        throw e2;
      }
    } else {
      throw err; // rethrow other errors
    }
  }

  const t1 = Date.now();

  const ctype = resp.headers["content-type"] || "text/html; charset=utf-8";
  const charsetMatch = /charset=([^;]+)/i.exec(ctype);
  const charset = (charsetMatch && charsetMatch[1]) || "utf-8";

  let html;
  try {
    html = iconv.decode(resp.body, charset);
  } catch {
    html = resp.body.toString("utf8");
  }

  const $ = cheerio.load(html);
  const resources = [];
  $("link[rel='stylesheet'], script[src], img[src]").each((_, el) => {
    const src = $(el).attr("href") || $(el).attr("src");
    if (!src) return;
    const abs = new URL(src, resp.url).toString();
    resources.push({ tag: el.tagName, url: abs });
  });

  const head = await Promise.allSettled(
    resources.slice(0, 10).map(async r => {
      try {
        const h = await got.head(r.url, { throwHttpErrors: false, timeout: { request: 12000 } });
        const size = Number(h.headers["content-length"] || 0);
        const type = h.headers["content-type"] || mime.lookup(r.url) || "";
        return { ...r, size, type };
      } catch {
        return { ...r, size: 0, type: "" };
      }
    })
  );

  const resc = head.map(x => (x.status === "fulfilled" ? x.value : x.reason)).filter(Boolean);

  const result = {
    finalUrl: resp.url,
    html,
    $,
    headers: resp.headers,
    timing: { serverResponse: 0, allContent: (t1 - t0) / 1000, allScripts: (t1 - t0) / 1000 },
    resources: resc,
  };

  // Cache the result for future requests
  fetchCache.set(u, result);

  return result;
}
