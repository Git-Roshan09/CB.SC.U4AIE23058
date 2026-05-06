const axios = require("axios");
const MinHeap = require("./minHeap");
const CONFIG = require("../config/config");
const { Log } = require("../../logging_middleware/index");


function computePriorityScore(notification) {
  const typeWeight = CONFIG.TYPE_WEIGHTS[notification.Type] || 1;

  const createdAt = new Date(notification.Timestamp);
  const now = new Date();
  const hoursElapsed = (now - createdAt) / (1000 * 60 * 60);

  const recencyMultiplier = 1 / (1 + hoursElapsed);

  return typeWeight * recencyMultiplier;
}


async function fetchNotifications() {
  await Log("backend", "info", "service", "Fetching notifications from test server");

  try {
    const response = await axios.get(CONFIG.NOTIFICATIONS_API, {
      headers: {
        Authorization: `Bearer ${CONFIG.AUTH_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    const notifications = response.data.notifications;
    await Log("backend", "info", "service", `Fetched ${notifications.length} notifications`);

    return notifications;
  } catch (error) {
    await Log("backend", "error", "service", `Failed to fetch notifications: ${error.message}`);
    throw error;
  }
}

async function getTopNPriority() {
  const notifications = await fetchNotifications();
  const N = CONFIG.TOP_N;

  await Log("backend", "debug", "service", `Computing top ${N} priority notifications from ${notifications.length} total`);

  const heap = new MinHeap();

  for(const notification of notifications){
    const score = computePriorityScore(notification);

    if (heap.size() < N){
      heap.push({ score, notification });
    } 
    else if (score > heap.peek().score){
      heap.pop();
      heap.push({ score, notification });
    }
  }

  const topNotifications = [];
  while (heap.size() > 0) {
    topNotifications.push(heap.pop());
  }

  topNotifications.reverse();

  await Log("backend", "info", "service", `Top ${N} notifications computed successfully`);

  return topNotifications.map((item, index) => ({
    rank: index + 1,
    priorityScore: parseFloat(item.score.toFixed(4)),
    id: item.notification.ID,
    type: item.notification.Type,
    message: item.notification.Message,
    timestamp: item.notification.Timestamp,
  }));
}

module.exports = { getTopNPriority };
