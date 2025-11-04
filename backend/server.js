const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

// ✅ Existing Cowboys routes (record, schedule, etc.)
const cowboysRoutes = require("./routes/cowboys");
app.use("/api/cowboys", cowboysRoutes);

// ✅ Root route for sanity check
app.get("/", (req, res) => {
  res.send("🏈 Cowboys Playoff Predictor API is running");
});

// ✅ (optional) Serve frontend if deployed together
if (process.env.NODE_ENV === "production") {
  const frontendPath = path.join(__dirname, "../frontend");
  app.use(express.static(frontendPath));

  app.get("*", (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

