const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

const cowboysRoutes = require("./routes/cowboys");
app.use("/api/cowboys", cowboysRoutes);

const predictionRoutes = require("./prediction");
app.use("/api/prediction", predictionRoutes);

app.get("/", (req, res) => {
  res.send("🏈 Cowboys Playoff Predictor API is running");
});

if (process.env.NODE_ENV === "production") {
  const frontendPath = path.join(__dirname, "../frontend");
  app.use(express.static(frontendPath));

  app.get("*", (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
