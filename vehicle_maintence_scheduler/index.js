// Load environment variables from .env file before anything else
require("dotenv").config();

const express = require("express");
const { Log } = require("../logging_middleware/index");
const schedulerRoutes = require("./routes/scheduler");

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());

// Log every incoming request to the test server
app.use(async (req, res, next) => {
  await Log(
    "backend",
    "info",
    "route",
    `Incoming request: ${req.method} ${req.path}`
  );
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/", schedulerRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "vehicle-maintenance-scheduler" });
});

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  await Log("backend", "info", "service", `Vehicle scheduler service started on port ${PORT}`);
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Hit GET http://localhost:${PORT}/schedule to run the optimization`);
});
