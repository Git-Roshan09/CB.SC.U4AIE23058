const CONFIG = {
  NOTIFICATIONS_API: "http://20.207.122.201/evaluation-service/notifications",
  AUTH_TOKEN: process.env.AUTH_TOKEN,

  TOP_N: 10,

  TYPE_WEIGHTS: {
    Placement: 3,
    Result: 2,
    Event: 1,
  },
};

module.exports = CONFIG;
