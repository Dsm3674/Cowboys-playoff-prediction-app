// -------------------------
// COWBOYS PLAYOFF PREDICTOR BACKEND (Fixed)
// -------------------------

const express = require("express");
const cors = require("cors");

// Import routes
const cowboysRouter = require("./routes/cowboys");
const predictionRouter = require("./prediction");
const superbowlPathRouter = require("./superbowlPath");
const teamRouter = require("./team2");

const app = express();

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: [
      "https://dsm3674.github.io",
      "http://localhost:3000",
      "http://localhost:5500",
      "http://127.0.0.1:5500"
    ],
  })
);

// Routes - Order matters! More specific routes first
app.use("/api/cowboys", cowboysRouter);
app.use("/api/prediction", predictionRouter);
app.use("/api/predictions", superbowlPathRouter); // Note: different from /prediction
app.use("/api/teams", teamRouter);

// Root route for Render check
app.get("/", (req, res) => {
  res.json({
    message: "🏈 Cowboys Playoff Predictor API is running successfully!",
    endpoints: {
      "cowboys-schedule": "/api/cowboys/schedule?year=2024",
      "cowboys-record": "/api/cowboys/record?year=2024",
      "prediction-current": "/api/prediction/current",
      "prediction-generate": "/api/prediction/generate (POST)",
      "prediction-history": "/api/prediction/history",
      "predictions-current": "/api/predictions/current",
      "predictions-generate": "/api/predictions/generate (POST)",
      "teams": "/api/teams/:teamId/current"
    },
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV !== 'production' ? err.message : undefined
  });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
});
