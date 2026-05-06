const { Log } = require("../../logging_middleware/index");

async function solveKnapsack(vehicles, mechanicHoursBudget) {
  
  const capacity = Math.floor(mechanicHoursBudget);
  const n = vehicles.length;

  await Log(
    "backend",
    "debug",
    "service",
    `Running knapsack: ${n} tasks, budget = ${capacity} hours`
  );

  
  const dp = new Array(capacity + 1).fill(0);

  
  for(let i = 0; i < n; i++){
    const duration = Math.floor(vehicles[i].Duration);
    const impact = vehicles[i].Impact;
    for(let w = capacity; w >= duration; w--){ 
      dp[w] = Math.max(dp[w], dp[w - duration] + impact);
    }
  }

  const maxImpact = dp[capacity];

  const table = Array.from({ length: n + 1 }, () => new Array(capacity + 1).fill(0));

  for(let i = 1; i <= n; i++){
    const duration = Math.floor(vehicles[i - 1].Duration);
    const impact = vehicles[i - 1].Impact;

    for(let w = 0; w <= capacity; w++){
      if(duration > w){
        table[i][w] = table[i - 1][w];
      } 
      else{
        table[i][w] = Math.max(table[i - 1][w], table[i - 1][w - duration] + impact);
      }
    }
  }

  const selectedTasks = [];
  let remainingCapacity = capacity;

  for(let i = n; i > 0; i--){
    
    if(table[i][remainingCapacity] !== table[i - 1][remainingCapacity]) {
      selectedTasks.push(vehicles[i - 1]);
      remainingCapacity -= Math.floor(vehicles[i - 1].Duration);
    }
  }

  await Log(
    "backend",
    "info",
    "service",
    `Knapsack complete — selected ${selectedTasks.length} tasks, total impact = ${maxImpact}`
  );

  return {
    maxImpact,
    selectedTasks,
    totalDuration: selectedTasks.reduce((sum, t) => sum + t.Duration, 0),
  };
}

module.exports = { solveKnapsack };
