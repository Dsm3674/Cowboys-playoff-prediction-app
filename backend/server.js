// -------------------------
// COWBOYS PLAYOFF PREDICTOR BACKEND
// -------------------------

import express from "express";
import cors from "cors";

// Import your Cowboys routes
import cowboysRouter from "./routes/cowboys.js"; // make sure this path exists

// Initialize app
const app = express();

// Middleware
app.use(express.json());

// Allow requests from your GitHub Pages frontend
app.use(
  cors({
    origin: [
      "https://dsm3674.github.io", // your GitHub Pages site
      "http://localhost:3000",     // for local testing
      "http://127.0.0.1:5500"
    ],
  })
);

// Routes
app.use("/api/cowboys", cowboysRouter);

// Root test route
app.get("/", (req, res) => {
  res.json({
    message: "🏈 Cowboys Playoff Predictor API is running successfully!",
    endpoints: {
      current: "/api/cowboys/current",
      generate: "/api/cowboys/generate",
      history: "/api/cowboys/history",
    },
  });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
