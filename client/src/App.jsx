import { useState } from "react";
import Report from "./Report.jsx";
const API_BASE = "https://seoback-g4ci.onrender.com";

// Listen for injected audit data when generating PDF
// --- For Puppeteer PDF rendering ---
if (typeof window !== "undefined") {
  window.addEventListener("auditDataReady", (ev) => {
    const data = ev.detail || window.auditPayload;
    if (!data) return;

    import("./Report.jsx").then(({ default: Report }) => {
      import("react-dom/client").then(({ createRoot }) => {
        const root = document.getElementById("root");
        createRoot(root).render(<Report data={data} />);
      });
    });
  });
}


export default function App(){
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
console.log("API Base URL:", API_BASE);

  async function runAudit(e){
    e.preventDefault();
    setErr(""); setData(null); setLoading(true);
    try{
      const r = await fetch(`${API_BASE}/api/audit`, {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body:JSON.stringify({ url, email })
      });
      const j = await r.json();
      if(!r.ok || !j.ok) throw new Error(j.error || "Audit failed");
      setData(j.result);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }catch(ex){ setErr(ex.message); }
    setLoading(false);
  }

  async function exportPdf(){
    if(!data) return;
    const r = await fetch(`${API_BASE}/api/audit/pdf`, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({ payload: data })
    });
    if(!r.ok){ return alert("PDF failed"); }
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "seo-audit.pdf";
    a.click();
  }

  return (
    <>
      <div className="header">
        <div className="wrap">
          <img src="/logo.png" alt="RankMeTop Logo"/>
          <h1>RankMeTop SEO Audit Tool</h1>
        </div>
      </div>

      <div className="container">
        <div className="card card--accent">
         <form onSubmit={runAudit} className="grid" style={{gridTemplateColumns:"1fr 2"}}>
  <div>
    <label htmlFor="audit-url">URL</label>
 <input
   id="audit-url"
      className="input mono"
      placeholder="https://example.com"
      value={url}
      onChange={(e)=>setUrl(e.target.value)}
      required
    />
  </div>

  <div style={{alignSelf:"end", display:"flex", gap:8}}>
    <button type="submit" className="btn" aria-label="Run Audit">
      {loading ? "Auditing…" : "Run Audit"}
    </button>
    {/* {data && (
      <button type="button" className="btn btn--ghost" onClick={exportPdf}>
        Download PDF
      </button>
    )} */}
  </div>
</form>

{err && <div style={{color:"#DC2626", marginTop:8}}>{err}</div>}
        </div>
{loading && (
          <div className="loading-container">
            <div className="loading-bar" style={{ width: `${progress}%` }}></div>
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
