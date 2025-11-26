

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());


const cowboysRoutes = require("./routes/cowboys");
app.use("/api/cowboys", cowboysRoutes);


const predictionRoutes = require("./superbowlPath");
app.use("/api/prediction", predictionRoutes);


const simulationRoutes = require("./routes/simulation");
app.use("/api/simulation", simulationRoutes);


const playersRoutes = require("./routes/players");
app.use("/api/players", playersRoutes);



const frontendPath = path.join(__dirname, "../frontend");


app.use(express.static(frontendPath));


app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});


app.get("*", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

