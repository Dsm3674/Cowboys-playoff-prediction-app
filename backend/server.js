// -------------------------
// COWBOYS PLAYOFF PREDICTOR BACKEND (Final Fixed Version)
// -------------------------

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

// -------------------------
// Middleware
// -------------------------
app.use(express.json());
app.use(
  cors({
    origin: [
      "https://dsm3674.github.io", // your GitHub Pages site
      "http://localhost:3000",
      "http://localhost:5500",
      "http://127.0.0.1:5500",
    ],
  })
);

// -------------------------
// API Routes
// -------------------------

// ✅ Main Cowboys router (handles /record, /schedule, etc.)
const cowboysRouter = require("./routes/cowboys");

// ✅ Import predictions (nested under cowboys)
const predictionRouter = require("./prediction");

// Attach prediction routes inside the cowboys API
// so /api/cowboys/current, /api/cowboys/generate, /api/cowboys/history all work
cowboysRouter.use("/", predictionRouter);

// Mount the combined router
app.use("/api/cowboys", cowboysRouter);

// ✅ Root sanity route
app.get("/", (req, res) => {
  res.json({
    message: "🏈 Cowboys Playoff Predictor API is running successfully!",
    endpoints: {
      "schedule": "/api/cowboys/schedule?year=2025",
      "record": "/api/cowboys/record?year=2025",
      "current prediction": "/api/cowboys/current",
      "generate prediction": "/api/cowboys/generate (POST)",
      "prediction history": "/api/cowboys/history",
    },
  });
});


if (process.env.NODE_ENV === "production") {
  const frontendPath = path.join(__dirname, "../frontend");
  app.use(express.static(frontendPath));

  app.get("*", (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
  });
}


app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV !== "production" ? err.message : undefined,
  });
});


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || "development"}`);
});

