const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

// =======================
// 1. API ROUTES
// =======================
const cowboysRoutes = require("./routes/cowboys");
app.use("/api/cowboys", cowboysRoutes);

// Fix: Make sure this file exists, usually named 'superbowlPath.js' or 'predictions.js'
// If you named it differently, update the require path below.
const predictionRoutes = require("./superbowlPath"); 
app.use("/api/prediction", predictionRoutes);

const simulationRoutes = require("./routes/simulation");
app.use("/api/simulation", simulationRoutes);

// =======================
// 2. SERVE FRONTEND (THE APP)
// =======================

// Define where the frontend files are located
const frontendPath = path.join(__dirname, "../frontend");

// Serve static files (CSS, JS, Images) from the frontend folder
app.use(express.static(frontendPath));

// For the root URL ("/"), explicitly send the index.html file
app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// "Catch-all" handler: For any request that doesn't match an API route,
// send back the React app (index.html).
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
