

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const rateLimit = require("express-rate-limit");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per window
});


const teamsRoutes = require("./routes/teams");
const cowboysRoutes = require("./routes/cowboys");
const authRoutes = require("./routes/auth");
const billingRoutes = require("./routes/billing");
app.use("/api/auth", authRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/teams", teamsRoutes);
app.use("/api/cowboys", cowboysRoutes);

const predictionRoutes = require("./superbowlPath");
app.use("/api/prediction", predictionRoutes);


const simulationRoutes = require("./routes/simulation");
app.use("/api/simulation", simulationRoutes);

const analyticsRoutes = require("./routes/analytics");
app.use("/api/analytics", analyticsRoutes);



const playersRoutes = require("./routes/players");
app.use("/api/players", playersRoutes);

const timelineRoutes = require("./routes/timeline");
app.use("/api/timeline", timelineRoutes);

const frontendPath = path.join(__dirname, "../frontend/dist");
const frontendIndexPath = path.join(frontendPath, "index.html");

function sendFrontendIndex(res) {
  res.set("Cache-Control", "no-store");
  res.sendFile(frontendIndexPath);
}

if (fs.existsSync(frontendIndexPath)) {
  app.use(express.static(frontendPath, { index: false }));

  app.get("/", generalLimiter, (req, res) => {
    sendFrontendIndex(res);
  });

  app.get("*", generalLimiter, (req, res) => {
    sendFrontendIndex(res);
  });
} else {
  app.get("/", generalLimiter, (_req, res) => {
    res.json({
      ok: true,
      service: "cowboys-playoff-predictor",
      message: "API running"
    });
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
