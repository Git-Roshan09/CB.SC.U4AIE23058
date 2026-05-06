require("dotenv").config();

const express = require("express");
const { Log } = require("../logging_middleware/index");
const notificationRoutes = require("./routes/notifications");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// Log every incoming request
app.use(async (req, res, next) => {
  await Log("backend", "info", "route", `Incoming: ${req.method} ${req.path}`);
  next();
});

app.use("/", notificationRoutes);

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "notification-app-be" });
});

app.listen(PORT, async () => {
  await Log("backend", "info", "service", `Notification service started on port ${PORT}`);
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Hit GET http://localhost:${PORT}/notifications/priority`);
});
