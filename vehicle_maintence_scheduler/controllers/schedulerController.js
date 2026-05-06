const { fetchDepots, fetchVehicles } = require("../services/apiService");
const { solveKnapsack } = require("../services/knapsackService");
const { Log } = require("../../logging_middleware/index");


async function getSchedule(req, res) {
  await Log("backend", "info", "handler", "Received request to compute vehicle schedule");

  try {
    const [depots, vehicles] = await Promise.all([fetchDepots(), fetchVehicles()]);

    const results = [];

    for (const depot of depots) {
      await Log(
        "backend",
        "debug",
        "handler",
        `Processing depot ${depot.ID} with budget = ${depot.MechanicHours} hours`
      );

      const result = await solveKnapsack(vehicles, depot.MechanicHours);

      results.push({
        depotID: depot.ID,
        mechanicHoursBudget: depot.MechanicHours,
        totalHoursUsed: result.totalDuration,
        totalImpactScore: result.maxImpact,
        selectedTasks: result.selectedTasks.map((task) => ({
          taskID: task.TaskID,
          duration: task.Duration,
          impact: task.Impact,
        })),
      });
    }

    await Log("backend", "info", "handler", "Schedule computed successfully for all depots");

    return res.status(200).json({
      success: true,
      totalDepots: depots.length,
      totalVehicleTasks: vehicles.length,
      schedule: results,
    });
  } catch (error) {
    await Log("backend", "error", "handler", `Schedule computation failed: ${error.message}`);

    return res.status(500).json({
      success: false,
      error: "Failed to compute schedule.",
    });
  }
}

module.exports = { getSchedule };
