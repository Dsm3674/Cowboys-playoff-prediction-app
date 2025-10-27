// backend/server.js
import express from "express";
import cors from "cors";
import cowboysRouter from "./routes/cowboys.js";

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json());

// Health
app.get("/health", (_req, res) => res.json({ ok: true }));

// Cowboys endpoints
app.use("/api/cowboys", cowboysRouter);

// Fallback
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
