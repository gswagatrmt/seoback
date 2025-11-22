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

  // Simulated slow smooth progress until response arrives
  let interval = setInterval(() => {
    setProgress(prev => {
      if (prev >= 98) return prev;       // Stop at 98%
      return prev + Math.random() * 2;   // Increase slowly & randomly
    });
  }, 800); // Slow ticking every 0.8s

  try {
    const r = await fetch(`${API_BASE}/api/audit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, email })
    });

    const j = await r.json();

    if (!r.ok || !j.ok) throw new Error(j.error || "Audit failed");

    // API finished → push to 100%
    clearInterval(interval);
    setProgress(100);

    setTimeout(() => {
      setData(j.result);
      setLoading(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 300);

  } catch (ex) {
    clearInterval(interval);
    setErr(ex.message);
    setLoading(false);
    setProgress(0);
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
    <div
      className="progress-bar progress-bar-striped progress-bar-animated"
      role="progressbar"
      aria-valuenow={progress} // Set the value dynamically from state
      aria-valuemin="0"
      aria-valuemax="100"
      style={{
        width: `${progress}%`,
        backgroundColor: '#1B84FF', // Blue color as per your CSS
        height: '30px',              // Height of the progress bar
        lineHeight: '28px',          // Line height for text centering
        fontSize: '15px',            // Font size for the progress text
        fontWeight: 'bold',          // Font weight for the text
        letterSpacing: '2px',        // Letter spacing for the text
        borderRadius: '4px',         // Border radius for smooth edges
      }}
    >
      {Math.round(progress)}% Complete
    </div>
  </div>
)}


        {/* Render the audit results */}
        {data && !loading && progress === 100 && <Report data={data} />}  {/* Show results after progress reaches 100% */}

        <div className="footer">&copy;2025 RankMeTop. All rights reserved.</div>
      </div>
    </>
  );
}
