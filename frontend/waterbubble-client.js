/*
Water Bubble Map API client.

How to use in Kanaan's prototype:
1. Put this file beside the HTML.
2. Replace the hardcoded `const SYS = [...]` with `let SYS = [];`
3. Add this script before the existing map script OR merge the functions into the map file.
4. Call `await bootstrapWaterBubbleData();` before rendering/init UI.
*/

const WATERBUBBLE_API_BASE = window.WATERBUBBLE_API_BASE || "http://localhost:8000";

async function fetchJson(path) {
  const response = await fetch(`${WATERBUBBLE_API_BASE}${path}`);
  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

async function bootstrapWaterBubbleData() {
  const systems = await fetchJson("/api/systems");

  // The existing prototype expects SYS entries shaped like:
  // { n, x, y, z, ec, col, fac, al, fs, per, d, bo, st, pc }
  window.SYS = systems;
  if (typeof SYS !== "undefined") {
    SYS = systems;
  }

  return systems;
}

async function getTradeLoops({
  cargoCapacity = 784,
  requiredPad = "L",
  maxAgeHours = 48,
  colonizationOnly = true,
  commodity = "",
  minProfitPerTon = 1,
  includeCarriers = false,
  limit = 50
} = {}) {
  const params = new URLSearchParams({
    cargo_capacity: cargoCapacity,
    required_pad: requiredPad,
    max_age_hours: maxAgeHours,
    colonization_only: colonizationOnly,
    min_profit_per_ton: minProfitPerTon,
    include_carriers: includeCarriers,
    limit
  });

  if (commodity) {
    params.set("commodity", commodity);
  }

  return fetchJson(`/api/trade-loops?${params.toString()}`);
}

function renderTradeLoopsIntoTable(tableBodyElement, loops) {
  tableBodyElement.innerHTML = "";

  for (const loop of loops) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(loop.commodity)}</td>
      <td>${escapeHtml(loop.fromSystem)}<br><small>${escapeHtml(loop.fromStation)}</small></td>
      <td>${escapeHtml(loop.toSystem)}<br><small>${escapeHtml(loop.toStation)}</small></td>
      <td>${loop.buyFromOriginAt.toLocaleString()}</td>
      <td>${loop.sellToDestinationAt.toLocaleString()}</td>
      <td>${loop.profitPerTon.toLocaleString()}</td>
      <td>${loop.tons.toLocaleString()}</td>
      <td>${loop.estimatedProfit.toLocaleString()}</td>
    `;
    tableBodyElement.appendChild(tr);
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

window.WaterBubbleAPI = {
  bootstrapWaterBubbleData,
  getTradeLoops,
  renderTradeLoopsIntoTable,
};
