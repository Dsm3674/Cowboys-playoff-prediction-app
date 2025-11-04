const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// -------------------------------
// ROUTES
// -------------------------------

// ✅ Main Cowboys routes (for record, schedule, etc.)
const cowboysRoutes = require("./routes/cowboys");
app.use("/api/cowboys", cowboysRoutes);

// ✅ Prediction routes (the new one you updated)
const predictionRoutes = require("./prediction");
app.use("/api/cowboys", predictionRoutes);

// -------------------------------
// HEALTH CHECK & FALLBACK
// -------------------------------
app.get("/", (req, res) => {
  res.send("✅ Cowboys Playoff Prediction API is running!");
});

// For production, serve your frontend if needed (optional)
if (process.env.NODE_ENV === "production") {
  const frontendPath = path.join(__dirname, "../frontend");
  app.use(express.static(frontendPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
  });
}

// -------------------------------
// SERVER START
// -------------------------------
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
