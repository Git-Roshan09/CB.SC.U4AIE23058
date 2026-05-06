const { getTopNPriority } = require("../services/priorityService");
const { Log } = require("../../logging_middleware/index");

async function getPriorityNotifications(req, res) {
  await Log("backend", "info", "handler", "Request received: GET /notifications/priority");

  try {
    const topNotifications = await getTopNPriority();

    await Log("backend", "info", "handler", `Returning ${topNotifications.length} priority notifications`);

    return res.status(200).json({
      success: true,
      count: topNotifications.length,
      notifications: topNotifications,
    });
  } catch (error) {
    await Log("backend", "error", "handler", `Failed to get notifications: ${error.message}`);

    return res.status(500).json({
      success: false,
      error: "Could not retrieve notifications.",
    });
  }
}

module.exports = { getPriorityNotifications };
