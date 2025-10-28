import "dotenv/config";  // Loads environment variables from .env file
import express from "express";
import path from "path";
import bodyParser from "body-parser";
import { fileURLToPath } from "url";
import cors from "cors";
import { auditSite } from "./audit/utils.js";
import { renderPdf } from "./audit/pdf.js";

// Use process.env to get environment variables for backend and frontend URLs
const FRONTEND_BASE = process.env.FRONTEND_URL;  // Use process.env for backend environment variables

// Initialize Express app
const app = express();

// CORS setup to allow frontend communication from the specified origin
app.use(cors({
  origin: FRONTEND_BASE,  // Set the frontend URL dynamically from environment variable
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

// Use bodyParser to parse incoming requests with JSON payload
app.use(bodyParser.json({ limit: "1mb" }));

// --- SAFE /api/audit route ---
app.post("/api/audit", async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url) {
      return res.status(400).json({ ok: false, error: "Missing URL parameter" });
    }

    console.log(`[AUDIT] Starting audit for: ${url}`);
    
    // Call audit function and handle errors
    const result = await auditSite(url).catch(err => {
      console.error("[AUDIT] auditSite() error:", err.message);
      if (err.stack) console.error(err.stack);
      return null; // return null to still respond cleanly
    });

    if (!result) {
      console.log("[AUDIT] Returning clean failure JSON.");
      return res.status(500).json({
        ok: false,
        error: "Audit process failed (no result returned). Check server logs.",
      });
    }

    // Defensive: ensure we always send something
    if (!result || typeof result !== "object") {
      console.error("[AUDIT] No valid result returned");
      return res.status(500).json({ ok: false, error: "Audit returned no data" });
    }

    console.log(`[AUDIT] Completed successfully for: ${url}`);
    return res.json({ ok: true, result });

  } catch (err) {
    console.error("[AUDIT] Fatal error:", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "Unknown server error"
    });
  }
});

// --- SAFE /api/audit/pdf route ---
app.post("/api/audit/pdf", async (req, res) => {
  try {
    const { payload } = req.body || {};
    if (!payload) return res.status(400).json({ ok: false, error: "Missing payload" });

    console.log("[PDF] Generating report...");
    
    // Generate PDF from the provided payload
    const buffer = await renderPdf(payload);
    if (!buffer?.length) throw new Error("Empty PDF buffer");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=seo-audit.pdf");
    res.end(buffer, "binary");

    console.log("[PDF] PDF successfully generated and sent.");
  } catch (err) {
    console.error("[PDF] Error:", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Set up the backend server to listen on the specified port (default to 8080)
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`SEO Audit running on :${PORT}`));

// Serve built client only in production
if (process.env.NODE_ENV === "production") {
  const dist = path.join(__dirname, "client", "dist"); // Path to build folder
  app.use(express.static(dist)); // Serve static files from the dist folder

  // Serve the React app's index.html for any route that isn't handled by the API
  app.get("*", (_, res) => res.sendFile(path.join(dist, "index.html")));
}
