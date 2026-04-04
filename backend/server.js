

const express = require("express");
const cors = require("cors");
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

const frontendPath = path.join(__dirname, "../frontend");


app.use(express.static(frontendPath));


app.get("/", generalLimiter, (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});


app.get("*", generalLimiter, (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

