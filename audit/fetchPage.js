import got from "got";
import * as cheerio from "cheerio";
import iconv from "iconv-lite";
import UserAgent from "user-agents";
import mime from "mime-types";

// Enhanced cache system for fetchPage results
const fetchCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes TTL
const MAX_CACHE_SIZE = 100; // Maximum cache entries
let cacheStats = { hits: 0, misses: 0, evictions: 0 };

// Cache entry structure
class CacheEntry {
  constructor(data) {
    this.data = data;
    this.timestamp = Date.now();
    this.accessCount = 0;
    this.lastAccessed = Date.now();
  }

  isExpired() {
    return Date.now() - this.timestamp > CACHE_TTL;
  }

  touch() {
    this.accessCount++;
    this.lastAccessed = Date.now();
  }
}

// Normalize URL for consistent caching
function normalizeUrl(url) {
  try {
    const urlObj = new URL(url);
    // Remove trailing slash, convert to lowercase, remove www prefix
    let normalized = urlObj.href.replace(/\/$/, '').toLowerCase();
    if (normalized.startsWith('http://www.')) {
      normalized = 'http://' + normalized.substring(11);
    } else if (normalized.startsWith('https://www.')) {
      normalized = 'https://' + normalized.substring(12);
    }
    return normalized;
  } catch {
    return url.toLowerCase();
  }
}

// Cache management functions
function cleanupExpiredCache() {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, entry] of fetchCache.entries()) {
    if (entry.isExpired()) {
      fetchCache.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[fetchPage] Cleaned ${cleaned} expired cache entries`);
  }
}

function enforceCacheSizeLimit() {
  if (fetchCache.size <= MAX_CACHE_SIZE) return;

  // Remove expired entries first
  cleanupExpiredCache();

  // If still over limit, remove least recently used entries
  if (fetchCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(fetchCache.entries())
      .map(([key, entry]) => ({ key, entry }))
      .sort((a, b) => a.entry.lastAccessed - b.entry.lastAccessed);

    const toRemove = fetchCache.size - MAX_CACHE_SIZE;
    for (let i = 0; i < toRemove; i++) {
      fetchCache.delete(entries[i].key);
      cacheStats.evictions++;
    }

    console.log(`[fetchPage] Evicted ${toRemove} LRU cache entries (size limit: ${MAX_CACHE_SIZE})`);
  }
}

function logCacheStats() {
  const total = cacheStats.hits + cacheStats.misses;
  const hitRate = total > 0 ? ((cacheStats.hits / total) * 100).toFixed(1) : '0.0';

  console.log(`[fetchPage] Cache stats: ${cacheStats.hits} hits, ${cacheStats.misses} misses, ${cacheStats.evictions} evictions (${hitRate}% hit rate, ${fetchCache.size} entries)`);
}

// Cache management utilities
export function clearFetchCache() {
  const size = fetchCache.size;
  fetchCache.clear();
  cacheStats = { hits: 0, misses: 0, evictions: 0 };
  console.log(`[fetchPage] 🗑️  Cleared cache (${size} entries removed)`);
  return size;
}

export function getCacheStats() {
  const total = cacheStats.hits + cacheStats.misses;
  const hitRate = total > 0 ? ((cacheStats.hits / total) * 100).toFixed(1) : '0.0';

  return {
    entries: fetchCache.size,
    maxSize: MAX_CACHE_SIZE,
    ttl: CACHE_TTL / 1000 / 60, // minutes
    stats: cacheStats,
    hitRate: hitRate + '%',
    memoryUsage: Array.from(fetchCache.values()).reduce((total, entry) => {
      // Rough estimation of memory usage
      const htmlSize = entry.data.html ? entry.data.html.length : 0;
      const resourcesSize = entry.data.resources ? JSON.stringify(entry.data.resources).length : 0;
      return total + htmlSize + resourcesSize + 1024; // +1KB for metadata
    }, 0)
  };
}

export function invalidateCacheEntry(url) {
  const normalizedUrl = normalizeUrl(url);
  const removed = fetchCache.delete(normalizedUrl);
  if (removed) {
    console.log(`[fetchPage] 🗑️  Invalidated cache entry for: ${url}`);
  }
  return removed;
}

// Periodic cache maintenance
setInterval(() => {
  cleanupExpiredCache();
  enforceCacheSizeLimit();
}, 5 * 60 * 1000); // Run every 5 minutes

// Graceful shutdown cleanup
process.on('exit', () => {
  console.log(`[fetchPage] Process exiting - cache had ${fetchCache.size} entries`);
});

export async function fetchPage(inputUrl) {
  const originalUrl = inputUrl.startsWith("http") ? inputUrl : `https://${inputUrl}`;
  const normalizedUrl = normalizeUrl(originalUrl);

  // Check cache with normalized URL
  const cachedEntry = fetchCache.get(normalizedUrl);
  if (cachedEntry && !cachedEntry.isExpired()) {
    cachedEntry.touch(); // Update access statistics
    cacheStats.hits++;
    console.log(`[fetchPage] ✅ Cache hit for: ${originalUrl} (normalized: ${normalizedUrl})`);
    return cachedEntry.data;
  }

  // Cache miss or expired
  if (cachedEntry && cachedEntry.isExpired()) {
    fetchCache.delete(normalizedUrl);
    console.log(`[fetchPage] ⏰ Cache expired for: ${originalUrl}`);
  }

  cacheStats.misses++;
  console.log(`[fetchPage] ❌ Cache miss for: ${originalUrl} (normalized: ${normalizedUrl})`);

  // Log cache stats periodically
  if ((cacheStats.hits + cacheStats.misses) % 10 === 0) {
    logCacheStats();
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
    cachedAt: new Date().toISOString(),
    cacheKey: normalizedUrl,
  };

  // Consider HTTP cache headers for cache duration
  let customTTL = CACHE_TTL;
  if (resp.headers['cache-control']) {
    const cacheControl = resp.headers['cache-control'];
    const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
    if (maxAgeMatch) {
      const maxAgeSeconds = parseInt(maxAgeMatch[1]);
      // Use server-recommended cache time, but cap at our maximum
      customTTL = Math.min(maxAgeSeconds * 1000, CACHE_TTL);
      console.log(`[fetchPage] 📅 Using server cache TTL: ${maxAgeSeconds}s (${(customTTL / 1000).toFixed(0)}s effective)`);
    }
  }

  // Store in enhanced cache with metadata
  const cacheEntry = new CacheEntry(result);
  // Override TTL if server specified shorter duration
  if (customTTL < CACHE_TTL) {
    cacheEntry.customTTL = customTTL;
    cacheEntry.isExpired = function() {
      return Date.now() - this.timestamp > this.customTTL;
    };
  }

  fetchCache.set(normalizedUrl, cacheEntry);

  // Enforce cache size limits
  enforceCacheSizeLimit();

  console.log(`[fetchPage] 📦 Cached result for: ${originalUrl} (${resc.length} resources, ${(html.length / 1024).toFixed(1)}KB HTML, TTL: ${(customTTL / 1000 / 60).toFixed(1)}min)`);

  return result;
}
