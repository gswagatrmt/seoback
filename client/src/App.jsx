import { useState } from "react";
import Report from "./Report.jsx";
const API_BASE = "https://seoback-g4ci.onrender.com"; // Your API Base URL

export default function App() {
  const [url, setUrl] = useState(""); // Website URL entered by user
  const [email, setEmail] = useState(""); // User email (if needed)
  const [loading, setLoading] = useState(false); // Loading indicator
  const [data, setData] = useState(null); // Store audit data
  const [err, setErr] = useState(""); // Store error messages
  const [progress, setProgress] = useState(0); // Track progress for the progress bar

  async function runAudit(e) {
    e.preventDefault(); // Prevent form submission refresh
    setErr(""); // Reset error message
    setData(null); // Reset previous data
    setLoading(true); // Show loading indicator
    setProgress(0); // Reset progress bar to 0

    const domainPattern = /^(?!:\/\/)([a-zA-Z0-9-_]+\.)+[a-zA-Z]{2,}$/; // Regex for valid URL

    if (!domainPattern.test(url)) {
      setErr("Please enter a valid website URL.");
      setLoading(false);
      return;
    }

    let progressInterval;

    try {
      // Simulate progress while the API request is ongoing
      progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(progressInterval); // Stop once progress reaches 100%
            return 100;
          }
          return Math.min(prev + 5, 100); // Increment progress by 5% every 500ms
        });
      }, 500); // Update progress every 500ms

      // Send POST request to backend for SEO audit
      const response = await fetch(`${API_BASE}/api/audit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, email }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Audit failed");
      }

      setData(result.result); // Store the result when the audit completes
    } catch (error) {
      setErr(error.message || "An error occurred.");
    } finally {
      setLoading(false); // Hide loading indicator once the request is finished
      clearInterval(progressInterval); // Clear the progress interval
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
          <form
            onSubmit={runAudit}
            className="grid"
            style={{ gridTemplateColumns: "1fr 2" }}
          >
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
              <button
                type="submit"
                className="btn"
                aria-label="Run Audit"
                disabled={loading}
              >
                {loading ? "Auditing…" : "Run Audit"}
              </button>
            </div>
          </form>

          {err && (
            <div style={{ color: "#DC2626", marginTop: 8 }}>{err}</div>
          )}
        </div>

        {loading && (
          <div className="loading-container">
            <div
              className="loading-bar"
              style={{ width: `${progress}%` }}
            ></div>
            <div className="loading-text">{Math.round(progress)}% Complete</div>
          </div>
        )}

        {/* Show the result only when the progress reaches 100% */}
        {data && !loading && progress === 100 && <Report data={data} />}

        <div className="footer">&copy;2025 RankMeTop. All rights reserved.</div>
      </div>
    </>
  );
}
