export async function localSeo(base) {
  const { $, html } = base;
  const ld = $("script[type='application/ld+json']")
    .map((_, e) => $(e).html())
    .get()
    .join("\n");
  const hasLocalBusiness = /"@type"\s*:\s*"LocalBusiness"/i.test(ld);
  const text = $("body").text();
  const phone = /\+?[0-9][0-9\s\-\(\)]{7,}/.test(text);
  const address = /(street|st\.|road|rd\.|ave|avenue|city|state|province|zip|postal)/i.test(text);

  //  Added: detect Google Business profile link or map embed
  const googleBusinessDetected =
    $("a[href*='google.com/maps'], a[href*='goo.gl/maps']").length > 0 ||
    /google\s*reviews|view\s*on\s*google/i.test(text);

  //  Added: simple review count extraction (stars or patterns)
  let reviewCount = null;
  const reviewMatch = text.match(/(\d{1,4})\s*(customer\s*)?reviews?/i);
  if (reviewMatch) {
    reviewCount = Number(reviewMatch[1]);
  } else if (/★★★★★|★{3,5}/.test(text)) {
    reviewCount = "stars"; // fallback mark
  }

  return {
    addressPhoneShown: { phone, address },
    localBusinessSchema: { present: hasLocalBusiness },
    googleBusinessProfile: { detected: googleBusinessDetected }, // ✅ updated
    reviews: { count: reviewCount } // ✅ updated
  };
}
