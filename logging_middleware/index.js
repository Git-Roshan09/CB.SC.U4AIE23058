const axios = require("axios");

const LOG_API_URL = "http://20.207.122.201/evaluation-service/logs";

async function Log(stack, level, packageName, message) {
  try {
    
    const body = {
      stack: stack,
      level: level,
      package: packageName,
      message: message,
    };

    
    const response = await axios.post(LOG_API_URL, body, {
      headers: {
        Authorization: `Bearer ${process.env.AUTH_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } 
  catch (error) {
  }
}

module.exports = { Log };
