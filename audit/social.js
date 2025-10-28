// Safe social analyzer – handles malformed HTML without crashing
export async function social(base) {
  const { $ } = base;
  let anchors = [];

  try {
    anchors = $("a").toArray()
      .map(el => {
        try {
          return $(el).attr("href") || "";
        } catch {
          return "";
        }
      })
      .filter(Boolean);
  } catch (e) {
    console.warn("[SOCIAL] Failed to collect anchors safely:", e.message);
    anchors = [];
  }

  // Safe helpers
  const safeGet = sel => {
    try {
      return $(sel).attr("content") || "";
    } catch {
      return "";
    }
  };

  const og = {
    title: safeGet("meta[property='og:title']"),
    desc: safeGet("meta[property='og:description']"),
    image: safeGet("meta[property='og:image']")
  };

  const twitter = {
    card: safeGet("meta[name='twitter:card']"),
    title: safeGet("meta[name='twitter:title']"),
    desc: safeGet("meta[name='twitter:description']")
  };

  const pixel = (() => {
    try {
      return $("script[src*='connect.facebook.net'], script:contains('fbq(')").length > 0;
    } catch {
      return false;
    }
  })();

  const find = rx => anchors.find(h => rx.test(h)) || null;

  return {
    links: {
      facebook: find(/facebook\.com/i),
      instagram: find(/instagram\.com/i),
      twitter: find(/(twitter|x)\.com/i),
      linkedin: find(/linkedin\.com/i),
      youtube: find(/youtube\.com|youtu\.be/i)
    },
    openGraph: { present: !!(og.title || og.desc || og.image), og },
    twitterCards: { present: !!(twitter.card || twitter.title || twitter.desc), twitter },
    facebookPixel: { present: pixel }
  };
}
