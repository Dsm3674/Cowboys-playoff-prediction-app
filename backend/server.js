const express = require("express");
const cors = require("cors");
const path = require("path");

// Routers
const cowboysRouter = require("./routes/cowboys");
const predictionRouter = require("./routes/prediction");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// API routes
app.use("/api/cowboys", cowboysRouter);
app.use("/api/prediction", predictionRouter);

// Root route
app.get("/", (_req, res) => {
  res.json({ message: "Cowboys Prediction API running" });
});

app.listen(PORT, () => console.log(`✅ Backend running on port ${PORT}`));

