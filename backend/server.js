// -------------------------
// COWBOYS PLAYOFF PREDICTOR BACKEND (CommonJS version)
// -------------------------


const express = require("express");
const cors = require("cors");

// Import Cowboys routes (make sure routes/cowboys.js exists)
const cowboysRouter = require("./routes/cowboys");

const app = express();

// Middleware
app.use(express.json());
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

// Root route for Render check
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
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
