const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const products = ["Cappuccino", "Latte", "Mocha"];

const forecastData = {
  Monday: { Cappuccino: 51, Latte: 80, Mocha: 55 },
  Tuesday: { Cappuccino: 47.5, Latte: 43, Mocha: 45.5 },
  Wednesday: { Cappuccino: 55.5, Latte: 56.5, Mocha: 58.5 },
  Thursday: { Cappuccino: 113, Latte: 94, Mocha: 131 },
  Friday: { Cappuccino: 136.5, Latte: 120.5, Mocha: 165 },
  Saturday: { Cappuccino: 112, Latte: 139.5, Mocha: 131.5 },
  Sunday: { Cappuccino: 69, Latte: 64.33, Mocha: 82.67 }
};
const baseForecastData = JSON.parse(JSON.stringify(forecastData));

const ingredientMatrix = {
  "Coffee Bean": { Cappuccino: 0.04, Latte: 0.025, Mocha: 0.03 },
  "Milk Foam": { Cappuccino: 0.01, Latte: 0.005, Mocha: 0 },
  "Steamed Milk": { Cappuccino: 0.01, Latte: 0.02, Mocha: 0.02 },
  "Chocolate Powder": { Cappuccino: 0, Latte: 0, Mocha: 0.015 }
};

const ingredientCosts = {
  "Coffee Bean": 14,
  "Milk Foam": 8,
  "Steamed Milk": 6,
  "Chocolate Powder": 5
};

const orderWindowMap = {
  Monday: ["Monday", "Tuesday", "Wednesday"],
  Thursday: ["Thursday", "Friday"],
  Saturday: ["Saturday", "Sunday"]
};

const orderTableBody = document.getElementById("orderTableBody");
const inventoryDaySelector = document.getElementById("inventoryDaySelector");
const runForecastBtn = document.getElementById("runForecastBtn");
const holdingCostRate = 0.1;

function getHoldingCostMultiplier() {
  const holdingInput = document.getElementById("holdingRange");
  return holdingInput ? Number(holdingInput.value) : 1;
}

function getIngredientHoldingCost(ingredient, endingInventory, multiplier = getHoldingCostMultiplier()) {
  return endingInventory * ingredientCosts[ingredient] * holdingCostRate * multiplier;
}

function computeWeeklyHoldingCostForIngredient(ingredient, dailyBalances, multiplier = getHoldingCostMultiplier()) {
  return weekdays.reduce((sum, day) => {
    const endingInventory = dailyBalances[ingredient]?.[day]?.endingInventory ?? 0;
    return sum + getIngredientHoldingCost(ingredient, endingInventory, multiplier);
  }, 0);
}

function computeWeeklySummary() {
  const totalByProduct = {};
  products.forEach((product) => {
    totalByProduct[product] = weekdays.reduce((sum, day) => sum + forecastData[day][product], 0);
  });

  const totalSales = Object.values(totalByProduct).reduce((sum, value) => sum + value, 0);
  const avgByProduct = {};
  products.forEach((product) => {
    avgByProduct[product] = totalByProduct[product] / weekdays.length;
  });

  document.getElementById("weeklySalesTotal").textContent = `${Math.round(totalSales).toLocaleString()} cups`;
  document.getElementById("avgCappuccino").textContent = avgByProduct.Cappuccino.toFixed(1);
  document.getElementById("avgLatte").textContent = avgByProduct.Latte.toFixed(1);
  document.getElementById("avgMocha").textContent = avgByProduct.Mocha.toFixed(1);

  const dailyTotal = weekdays.map((day) => {
    const total = products.reduce((sum, product) => sum + forecastData[day][product], 0);
    return { day, total };
  });

  return { totalSales, avgByProduct, dailyTotal, totalByProduct };
}

function updateDemandImpactNote() {
  const noteEl = document.getElementById("demandImpactNote");
  const currentTotal = weekdays.reduce((sum, day) => sum + products.reduce((pSum, product) => pSum + forecastData[day][product], 0), 0);
  const baseTotal = weekdays.reduce((sum, day) => sum + products.reduce((pSum, product) => pSum + baseForecastData[day][product], 0), 0);
  const changePct = ((currentTotal - baseTotal) / baseTotal) * 100;

  if (Math.abs(changePct) < 0.1) {
    noteEl.textContent = "Projected order plan is based on the current demand forecast and remains aligned with the baseline scenario.";
    return;
  }

  const direction = changePct > 0 ? "increases" : "decreases";
  const absPercent = Math.abs(changePct).toFixed(1);
  noteEl.textContent = `Demand ${direction} by ${absPercent}% compared with the baseline, so the projected order plan for raw materials is adjusted accordingly.`;
}

function computeIngredientOrderPlan() {
  const plans = {};
  const schedule = [];

  Object.keys(ingredientMatrix).forEach((ingredient) => {
    let inventory = 0;
    let plannedQty = 0;
    let totalCost = 0;
    const inventoryBalance = {};

    const windowDefinitions = [
      { orderDay: "Monday", label: "Mon–Wed", days: ["Monday", "Tuesday", "Wednesday"] },
      { orderDay: "Thursday", label: "Thu–Fri", days: ["Thursday", "Friday"] },
      { orderDay: "Saturday", label: "Sat–Sun", days: ["Saturday", "Sunday"] }
    ];

    windowDefinitions.forEach((window) => {
      const demandForWindow = window.days.reduce((sum, day) => {
        return sum + products.reduce((productSum, product) => {
          return productSum + forecastData[day][product] * ingredientMatrix[ingredient][product];
        }, 0);
      }, 0);

      const openingInventory = inventory;
      const orderQty = Math.max(0, demandForWindow - openingInventory);
      const unitCost = ingredientCosts[ingredient] * (window.orderDay === "Thursday" ? 0.85 : 1);
      const orderCost = orderQty * unitCost;
      const endingInventory = Math.max(0, openingInventory + orderQty - demandForWindow);

      inventory = endingInventory;
      plannedQty += orderQty;
      totalCost += orderCost;

      inventoryBalance[window.label] = endingInventory;

      schedule.push({
        ingredient,
        orderDay: window.orderDay,
        window: window.label,
        orderQty,
        openingInventory,
        endingInventory,
        unitCost,
        cost: orderCost
      });
    });

    const candidateOrderDays = {
      Monday: ingredientCosts[ingredient],
      Thursday: ingredientCosts[ingredient] * 0.85,
      Saturday: ingredientCosts[ingredient]
    };
    const bestOrderDay = Object.entries(candidateOrderDays).sort(([, a], [, b]) => a - b)[0][0];
    const totalDemand = weekdays.reduce((sum, day) => {
      return sum + products.reduce((productSum, product) => {
        return productSum + forecastData[day][product] * ingredientMatrix[ingredient][product];
      }, 0);
    }, 0);

    plans[ingredient] = {
      plannedQty,
      bestOrderDay,
      cost: totalCost,
      finalBalance: inventory,
      windows: inventoryBalance,
      totalDemand: Number(totalDemand.toFixed(2))
    };
  });

  return { plans, schedule };
}

function computeDailyInventoryBalances() {
  const balances = {};

  Object.keys(ingredientMatrix).forEach((ingredient) => {
    let inventory = 0;
    const dailyInventory = {};
    const orderQtyByDay = { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0 };

    const windowDefinitions = [
      { orderDay: "Monday", days: ["Monday", "Tuesday", "Wednesday"] },
      { orderDay: "Thursday", days: ["Thursday", "Friday"] },
      { orderDay: "Saturday", days: ["Saturday", "Sunday"] }
    ];

    windowDefinitions.forEach(({ orderDay, days }) => {
      const demandForWindow = days.reduce((sum, day) => {
        return sum + products.reduce((productSum, product) => {
          return productSum + forecastData[day][product] * ingredientMatrix[ingredient][product];
        }, 0);
      }, 0);
      const orderQty = Math.max(0, demandForWindow - inventory);
      orderQtyByDay[orderDay] = orderQty;
    });

    weekdays.forEach((day) => {
      const openingInventory = inventory;

      if (day === "Monday" || day === "Thursday" || day === "Saturday") {
        inventory += orderQtyByDay[day];
      }

      const dailyDemand = products.reduce((sum, product) => {
        return sum + forecastData[day][product] * ingredientMatrix[ingredient][product];
      }, 0);

      inventory = Math.max(0, inventory - dailyDemand);
      const holdingCost = getIngredientHoldingCost(ingredient, inventory, getHoldingCostMultiplier());
      dailyInventory[day] = {
        openingInventory,
        consumedQty: dailyDemand,
        endingInventory: inventory,
        holdingCost,
        balance: inventory
      };
    });

    balances[ingredient] = dailyInventory;
  });

  return balances;
}

function renderOrderTable() {
  const rows = [];
  const orderPlan = computeIngredientOrderPlan();
  const plans = orderPlan.plans;
  const selectedDay = inventoryDaySelector ? inventoryDaySelector.value : "Monday";
  const dailyBalances = computeDailyInventoryBalances();

  Object.keys(ingredientMatrix).forEach((ingredient) => {
    const plan = plans[ingredient];
    const unitCost = ingredientCosts[ingredient] * (plan.bestOrderDay === "Thursday" ? 0.85 : 1);
    rows.push(`
      <tr>
        <td>${ingredient}</td>
        <td>${plan.totalDemand.toFixed(2)} kg</td>
        <td>${plan.bestOrderDay}</td>
        <td>$${unitCost.toFixed(2)}</td>
      </tr>
    `);
  });

  orderTableBody.innerHTML = rows.join("");

  const ingredientTotal = Object.keys(ingredientMatrix).reduce((sum, ingredient) => {
    return sum + plans[ingredient].totalDemand;
  }, 0);

  const ingredientOrderCost = Object.keys(ingredientMatrix).reduce((sum, ingredient) => {
    return sum + plans[ingredient].cost;
  }, 0);

  const holdingCost = Object.keys(ingredientMatrix).reduce((sum, ingredient) => {
    return sum + computeWeeklyHoldingCostForIngredient(ingredient, dailyBalances, getHoldingCostMultiplier());
  }, 0);

  const totalWeeklyCost = ingredientOrderCost + holdingCost;

  document.getElementById("materialUseTotal").textContent = `${ingredientTotal.toFixed(1)} Kg`;
  document.getElementById("ingredientOrderCost").textContent = `$${ingredientOrderCost.toFixed(2)}`;
  document.getElementById("holdingCostTotal").textContent = `$${holdingCost.toFixed(2)}`;
  document.getElementById("weeklyTotalCost").textContent = `$${totalWeeklyCost.toFixed(2)}`;

  const orderDayColumns = ["Monday", "Thursday", "Saturday"];
  const scheduleRows = Object.keys(ingredientMatrix).map((ingredient) => {
    const quantityCells = orderDayColumns.map((orderDay) => {
      const item = orderPlan.schedule.find((entry) => entry.ingredient === ingredient && entry.orderDay === orderDay);
      const qty = item ? Number(item.orderQty.toFixed(2)) : 0;
      return `<td>${qty.toFixed(2)} kg</td>`;
    }).join("");

    const totalQty = Number(orderDayColumns.reduce((sum, orderDay) => {
      const item = orderPlan.schedule.find((entry) => entry.ingredient === ingredient && entry.orderDay === orderDay);
      return sum + (item ? Number(item.orderQty.toFixed(2)) : 0);
    }, 0).toFixed(2));

    return `
      <tr>
        <td>${ingredient}</td>
        ${quantityCells}
        <td>${totalQty.toFixed(2)} kg</td>
      </tr>
    `;
  }).join("");
  document.getElementById("orderScheduleTableBody").innerHTML = scheduleRows;

  const inventoryRows = Object.keys(ingredientMatrix).map((ingredient) => {
    const selectedDayData = dailyBalances[ingredient][selectedDay] || { openingInventory: 0, consumedQty: 0, endingInventory: 0, holdingCost: 0 };
    const openingInventory = selectedDayData.openingInventory.toFixed(2);
    const consumedQty = selectedDayData.consumedQty.toFixed(2);
    const endingInventory = selectedDayData.endingInventory.toFixed(2);
    const holdingCostValue = selectedDayData.holdingCost.toFixed(2);

    return `
      <tr>
        <td>${ingredient}</td>
        <td>${openingInventory} kg</td>
        <td>${consumedQty} kg</td>
        <td>${endingInventory} kg</td>
        <td>$${holdingCostValue}</td>
      </tr>
    `;
  }).join("");

  document.getElementById("inventoryBalanceTableBody").innerHTML = inventoryRows;

  const selectedDayLabel = document.getElementById("selectedBalanceDay");
  if (selectedDayLabel) {
    selectedDayLabel.textContent = selectedDay;
  }

  updateDemandImpactNote();
}

function renderDemandChart(activeIndex = null) {
  const { dailyTotal } = computeWeeklySummary();
  const svg = document.getElementById("demandChart");
  const width = 640;
  const height = 280;
  const padding = 32;
  const colors = {
    Cappuccino: "#3a7bd5",
    Latte: "#f59e0b",
    Mocha: "#1faa7a"
  };

  const allValues = weekdays.flatMap((day) => products.map((product) => forecastData[day][product]));
  const maxValue = Math.max(...allValues) * 1.15;

  const xStep = (width - padding * 2) / (dailyTotal.length - 1);
  const toY = (value) => height - padding - (value / maxValue) * (height - padding * 2);
  const xPositions = weekdays.map((_, index) => padding + index * xStep);

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const y = padding + ratio * (height - padding * 2);
    return `<line x1="${padding}" x2="${width - padding}" y1="${y}" y2="${y}" stroke="#dfe7f4" stroke-dasharray="4 6"/>`;
  }).join("");

  const axisLabels = dailyTotal.map((item, index) => {
    const x = xPositions[index];
    return `<text x="${x}" y="${height - 10}" text-anchor="middle" fill="#67758b" font-size="12">${item.day.slice(0, 3)}</text>`;
  }).join("");

  const seriesMarkup = products.map((product) => {
    const points = weekdays.map((day, index) => {
      const x = xPositions[index];
      const y = toY(forecastData[day][product]);
      return `${x},${y}`;
    }).join(" ");

    const dots = weekdays.map((day, index) => {
      const x = xPositions[index];
      const y = toY(forecastData[day][product]);
      return `<circle cx="${x}" cy="${y}" r="4" fill="${colors[product]}"/>`;
    }).join("");

    return `
      <polyline points="${points}" fill="none" stroke="${colors[product]}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}
    `;
  }).join("");

  const legend = products.map((product) => `
    <g>
      <line x1="${padding + 12}" x2="${padding + 32}" y1="${30 + products.indexOf(product) * 18}" y2="${30 + products.indexOf(product) * 18}" stroke="${colors[product]}" stroke-width="3"/>
      <text x="${padding + 40}" y="${34 + products.indexOf(product) * 18}" fill="#132238" font-size="12">${product}</text>
    </g>
  `).join("");

  const hoverMarkup = activeIndex === null ? "" : (() => {
    const day = weekdays[activeIndex];
    const x = xPositions[activeIndex];

    const labelRects = products.map((product, idx) => {
      const value = forecastData[day][product];
      const y = toY(value);
      const labelY = 38 + idx * 18;
      return `
        <g>
          <rect x="${width - 138}" y="${labelY - 12}" width="108" height="16" rx="8" fill="rgba(19,34,56,0.9)"/>
          <text x="${width - 128}" y="${labelY}" fill="#ffffff" font-size="11" font-weight="600">${product}: ${value.toFixed(0)}</text>
        </g>
      `;
    }).join("");

    return `
      <line x1="${x}" x2="${x}" y1="${padding}" y2="${height - padding}" stroke="#132238" stroke-dasharray="5 5" stroke-width="1.5" opacity="0.7"/>
      <circle cx="${x}" cy="${toY(forecastData[day]["Cappuccino"]) }" r="5" fill="#3a7bd5"/>
      <circle cx="${x}" cy="${toY(forecastData[day]["Latte"]) }" r="5" fill="#f59e0b"/>
      <circle cx="${x}" cy="${toY(forecastData[day]["Mocha"]) }" r="5" fill="#1faa7a"/>
      <text x="${x}" y="${padding - 8}" text-anchor="middle" fill="#132238" font-size="12" font-weight="700">${day}</text>
      ${labelRects}
    `;
  })();

  svg.innerHTML = `
    ${gridLines}
    ${seriesMarkup}
    ${axisLabels}
    ${legend}
    ${hoverMarkup}
    <text x="${padding}" y="16" fill="#67758b" font-size="12">Demand (cups)</text>
  `;

  svg.onmousemove = (event) => {
    const rect = svg.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * width;
    const proposedIndex = Math.min(weekdays.length - 1, Math.max(0, Math.round((px - padding) / xStep)));
    renderDemandChart(proposedIndex);
  };

  svg.onmouseleave = () => renderDemandChart();
}

function buildScenarioForecast() {
  const demandShift = Number(document.getElementById("demandRange").value);
  const multiplier = 1 + demandShift / 100;

  const scenario = {};
  Object.keys(forecastData).forEach((day) => {
    scenario[day] = {};
    Object.keys(forecastData[day]).forEach((product) => {
      scenario[day][product] = forecastData[day][product] * multiplier;
    });
  });

  return scenario;
}

function getScenarioOrderPlan() {
  const originalForecast = JSON.parse(JSON.stringify(forecastData));
  const scenarioForecast = buildScenarioForecast();

  Object.keys(forecastData).forEach((day) => {
    Object.keys(forecastData[day]).forEach((product) => {
      forecastData[day][product] = scenarioForecast[day][product];
    });
  });

  const scenarioPlan = computeIngredientOrderPlan();

  Object.keys(forecastData).forEach((day) => {
    Object.keys(forecastData[day]).forEach((product) => {
      forecastData[day][product] = originalForecast[day][product];
    });
  });

  return scenarioPlan;
}

function updateSensitivity() {
  const discount = Number(document.getElementById("discountRange").value);
  const holding = Number(document.getElementById("holdingRange").value);
  const demandShift = Number(document.getElementById("demandRange").value);

  document.getElementById("discountValue").textContent = `${discount}%`;
  document.getElementById("holdingValue").textContent = `${holding.toFixed(1)}×`;
  document.getElementById("demandValue").textContent = `${demandShift >= 0 ? "+" : ""}${demandShift}%`;

  const scenarioPlan = getScenarioOrderPlan();
  const orderCost = Object.values(scenarioPlan.plans).reduce((sum, plan) => sum + plan.cost, 0);
  const dailyBalances = computeDailyInventoryBalances();
  const holdingCost = Object.keys(ingredientMatrix).reduce((sum, ingredient) => {
    return sum + computeWeeklyHoldingCostForIngredient(ingredient, dailyBalances, holding);
  }, 0);

  document.getElementById("orderCostValue").textContent = `$${Math.round(orderCost).toLocaleString()}`;
  document.getElementById("holdCostValue").textContent = `$${Math.round(holdingCost).toLocaleString()}`;
  renderOrderTable();

  let recommendation = "Maintain current weekly order";
  if (demandShift > 10) {
    recommendation = "Increase Thursday safety stock";
  } else if (discount > 20) {
    recommendation = "Advance Thursday order";
  } else if (holding > 1.5) {
    recommendation = "Reduce inventory holding";
  }

  document.getElementById("recommendValue").textContent = recommendation;
}

function attachSensiListeners() {
  ["discountRange", "holdingRange", "demandRange"].forEach((id) => {
    document.getElementById(id).addEventListener("input", updateSensitivity);
  });
}

function updateManagerDemand() {
  const inputs = document.querySelectorAll("input[data-product]");
  inputs.forEach((input) => {
    const day = input.dataset.day;
    const product = input.dataset.product;
    const value = Number(input.value);
    if (!Number.isNaN(value) && value > 0) {
      forecastData[day][product] = value;
    }
  });

  // Assumption: no inventory is held before Monday, and weekly inventory is reset at the start of each week.
  Object.keys(forecastData).forEach((day) => {
    Object.keys(forecastData[day]).forEach((product) => {
      if (Number.isNaN(forecastData[day][product])) {
        forecastData[day][product] = 0;
      }
    });
  });

  renderOrderTable();
  renderDemandChart();
}

const demandInputs = document.querySelectorAll("input[data-product]");
demandInputs.forEach((input) => {
  input.addEventListener("input", updateManagerDemand);
});

if (inventoryDaySelector) {
  inventoryDaySelector.addEventListener("change", renderOrderTable);
}

runForecastBtn.addEventListener("click", updateManagerDemand);
attachSensiListeners();
renderOrderTable();
renderDemandChart();
updateSensitivity();
