// backend/server.js
const express = require('express');
const cors = require('cors');
const cowboysRouter = require('./routes/cowboys');
const team2Router = require('./team2');
const superbowlRouter = require('./superbowlPath');

const app = express();

app.use(cors({
  origin: [
    "https://cowboys-playoff-prediction-app.vercel.app",
    "https://cowboys-playoff-prediction-app.onrender.com",
    "http://localhost:3000",
  ],
}));

app.use(express.json());

// Health check
app.get("/health", (_req, res) => res.json({ ok: true }));

// Routes
app.use("/api/cowboys", cowboysRouter);
app.use("/api/teams", team2Router);
app.use("/api/predictions", superbowlRouter);

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ API running at http://localhost:${PORT}`);
});

