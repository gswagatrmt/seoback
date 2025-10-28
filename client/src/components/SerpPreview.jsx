import { useMemo } from "react";
import { MoreVertical } from "lucide-react"; // lightweight 3-dot icon

export default function SerpPreview({ url, title, description, favicon }) {
  const parsed = useMemo(() => {
    try {
      const u = new URL(url);
      return {
        hostname: u.hostname.replace(/^www\./, ""),
        path: u.pathname
          .split("/")
          .filter(Boolean)
          .slice(0, 3)
          .join(" › "),
      };
    } catch {
      return { hostname: url, path: "" };
    }
  }, [url]);

  const icon = favicon || `https://www.google.com/s2/favicons?domain=${parsed.hostname}`;

    const trim = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + "…" : s || "");
  return (
    <div className="serp-card">
      <div className="serp-top">
        <div className="serp-left">
          <img src={icon} alt="favicon" className="serp-favicon" />
          <div className="serp-meta">
            <div className="serp-host">{parsed.hostname}</div>
            {parsed.path && <div className="serp-path">{parsed.path}</div>}
          </div>
        </div>
        <MoreVertical size={16} className="serp-menu" />
      </div>

     <div className="serp-title" aria-live="polite">{trim(title, 70) || "(No title found)"}</div>
      <div className="serp-desc">{trim(description, 160) || "(No meta description found)"}</div>
    </div>
  );
}
