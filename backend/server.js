// backend/server.js
const express = require('express');
const cors = require('cors');
const cowboysRouter = require('./routes/cowboys.js');
const team2Router = require('./team2.js');

const app = express();

app.use(cors({
  origin: [
    "https://cowboys-playoff-website.vercel.app",
    "http://localhost:5173",
  ],
}));

app.use(express.json());


app.get("/health", (_req, res) => res.json({ ok: true }));


app.use("/api/cowboys", cowboysRouter);


app.use("/api/teams", team2Router);

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
