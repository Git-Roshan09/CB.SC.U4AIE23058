const axios = require("axios");
const CONFIG = require("../config/config");
const { Log } = require("../../logging_middleware/index");

function getAuthHeaders() {
  return {
    Authorization: `Bearer ${CONFIG.AUTH_TOKEN}`,
    "Content-Type": "application/json",
  };
}


async function fetchDepots() {
  await Log("backend", "info", "service", "Fetching depots from test server");

  try {
    const response = await axios.get(CONFIG.DEPOTS_API, {
      headers: getAuthHeaders(),
    });

    const depots = response.data.depots;
    await Log("backend", "info", "service", `Fetched ${depots.length} depots successfully`);

    return depots;
  } catch (error) {
    await Log("backend", "error", "service", `Failed to fetch depots: ${error.message}`);
    throw error;
  }
}

async function fetchVehicles() {
  await Log("backend", "info", "service", "Fetching vehicles from test server");

  try {
    const response = await axios.get(CONFIG.VEHICLES_API, {
      headers: getAuthHeaders(),
    });

    const vehicles = response.data.vehicles;
    await Log("backend", "info", "service", `Fetched ${vehicles.length} vehicle tasks successfully`);

    return vehicles;
  } catch (error) {
    await Log("backend", "error", "service", `Failed to fetch vehicles: ${error.message}`);
    throw error;
  }
}

module.exports = { fetchDepots, fetchVehicles };
