export async function usability(base) {
  const { $ } = base;
  const viewport = $("meta[name='viewport']").attr("content") || "";
  const hasViewport = /width=device-width/i.test(viewport);
  const hasFavicon = $("link[rel='icon'], link[rel='shortcut icon']").length > 0;
  return {
    deviceRendering: { ok: true },
    coreWebVitals: { hasCrux: false },
    viewport: { present: hasViewport },
    pageSpeedInsights: { mobile: null, desktop: null },
    flash: { used: false },
    iframes: { used: $("iframe").length > 0 ? true : false },
    favicon: { present: hasFavicon },
    emailPrivacy: { plainTextEmails: 0 },
    legibleFonts: { ok: true },
    tapTargets: { ok: true }
  };
}
