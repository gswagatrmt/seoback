import { useState } from "react";
import Report from "./Report.jsx";
const API_BASE = "https://seoback-g4ci.onrender.com"; // Your API Base URL

export default function App() {
  const [url, setUrl] = useState("");  // For storing website URL entered by user
  const [email, setEmail] = useState("");  // For storing email
  const [loading, setLoading] = useState(false);  // Loading indicator
  const [data, setData] = useState(null);  // Store audit data
  const [err, setErr] = useState("");  // Store error messages
  const [progress, setProgress] = useState(0);  // Track progress for the progress bar

async function runAudit(e) {
  e.preventDefault();

  setErr("");
  setData(null);
  setLoading(true);
  setProgress(0);

  // Initial slow rise – loading state (waiting for server to start returning)
  let interval = setInterval(() => {
    setProgress(prev => {
      if (prev >= 20) return prev; 
      return prev + 1;
    });
  }, 150);

  try {
    const fetchStart = Date.now();

    const r = await fetch(`${API_BASE}/api/audit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, email })
    });

    // API responded — speed up progress to 80%
    clearInterval(interval);
    interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 80) return prev;
        return prev + 2;
      });
    }, 50);

    const j = await r.json();

    if (!r.ok || !j.ok) throw new Error(j.error || "Audit failed");

    // Final fast completion to 100%
    clearInterval(interval);
    interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 4;
      });
    }, 30);

    // Delay for smooth UI
    setTimeout(() => {
      setData(j.result);
      setLoading(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 300);

  } catch (ex) {
    clearInterval(interval);
    setErr(ex.message);
    setLoading(false);
  }
}
  

  return (
    <>
      <div className="header">
        <div className="wrap">
          <img src="/logo.png" alt="RankMeTop Logo" />
          <h1>RankMeTop SEO Audit Tool</h1>
        </div>
      </div>

      <div className="container">
        <div className="card card--accent">
          <form onSubmit={runAudit} className="grid" style={{ gridTemplateColumns: "1fr 2" }}>
            <div>
              <label htmlFor="audit-url">URL</label>
              <input
                id="audit-url"
                className="input mono"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
            </div>

            <div style={{ alignSelf: "end", display: "flex", gap: 8 }}>
              <button type="submit" className="btn" aria-label="Run Audit" disabled={loading}>
                {loading ? "Auditing…" : "Run Audit"}
              </button>
            </div>
          </form>

          {err && <div style={{ color: "#DC2626", marginTop: 8 }}>{err}</div>}
        </div>

        {/* Progress Bar */}
        {loading && (
          <div className="loading-container" style={{ marginTop: "20px" }}>
            <div className="loading-bar" style={{ width: `${progress}%` }}></div>
            <div className="loading-text">{Math.round(progress)}% Complete</div>
          </div>
        )}

        {/* Render the audit results */}
        {data && !loading && progress === 100 && <Report data={data} />}  {/* Show results after progress reaches 100% */}

        <div className="footer">&copy;2025 RankMeTop. All rights reserved.</div>
      </div>
    </>
  );
}
