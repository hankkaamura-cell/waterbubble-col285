import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";

const API_URL = "https://spansh.co.uk/api/systems/search";
const PAGE_SIZE = 100;
const DEFAULT_REFERENCE = "Col 285 Sector FI-J c9-2";
const DEFAULT_RADIUS_LY = 75;
const DEFAULT_PORT = 8787;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, text) {
  res.writeHead(status, {
    "Content-Type": "text/plain",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(text);
}

function normalizeValue(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

function flattenRecord(record, prefix = "") {
  const flat = {};
  for (const [key, value] of Object.entries(record)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(flat, flattenRecord(value, nextKey));
    } else {
      flat[nextKey] = normalizeValue(value);
    }
  }
  return flat;
}

function toNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function toBool(value) {
  if (value === null || value === undefined) return undefined;
  const s = String(value).trim().toLowerCase();
  if (["true", "1", "yes"].includes(s)) return true;
  if (["false", "0", "no"].includes(s)) return false;
  return undefined;
}

function sanitizeFilename(value) {
  return value.replace(/[^a-z0-9-_]+/gi, "-").replace(/(^-|-$)/g, "");
}

function planetClassFromBodies(bodies) {
  let hasWater = false;
  let hasAmmonia = false;

  for (const body of bodies ?? []) {
    if (!body || typeof body !== "object") continue;
    const subtype = String(body.subtype ?? "").toLowerCase();

    if (!subtype) continue;
    if (subtype.includes("earth-like") || subtype.includes("earth like")) return "Earth-like World";
    if (subtype.includes("water world")) hasWater = true;
    if (subtype.includes("ammonia world")) hasAmmonia = true;
  }

  if (hasWater) return "Water World";
  if (hasAmmonia) return "Ammonia World";
  return "Other";
}

function parseCoords(params) {
  const x = Number(params.get("x"));
  const y = Number(params.get("y"));
  const z = Number(params.get("z"));

  if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
    return { x, y, z };
  }

  return null;
}

async function fetchPage(page, reference, radius, coords) {
  const payload = {
    filters: {
      distance: { min: 0, max: radius },
      distance_from: coords ?? { system: reference },
    },
    sort: [{ field: "name", direction: "asc" }],
    size: PAGE_SIZE,
    page,
  };

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": "xH20-command-center/1.0 (spansh proxy)",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Spansh API Fehler: ${response.status} ${response.statusText} - ${text}`);
  }

  return response.json();
}

async function fetchAllSystems(reference, radius, coords) {
  let page = 0;
  let total = 0;
  const results = [];

  while (true) {
    const data = await fetchPage(page, reference, radius, coords);
    const pageResults = data?.results ?? [];
    total = data?.count ?? total;
    results.push(...pageResults);
    page += 1;

    if (results.length >= total || pageResults.length === 0) {
      break;
    }
  }

  return results;
}

function mapToSystemRecord(system) {
  const position = system?.coords ?? system?.position ?? {};
  const bodies = Array.isArray(system?.bodies) ? system.bodies : [];
  const stations = Array.isArray(system?.stations) ? system.stations : [];
  return {
    name: system?.name ?? "",
    x: toNum(system?.x ?? position?.x),
    y: toNum(system?.y ?? position?.y),
    z: toNum(system?.z ?? position?.z),
    distanceLy: toNum(system?.distance),
    faction: system?.controlling_minor_faction ?? system?.faction,
    factionState: system?.controlling_minor_faction_state ?? system?.faction_state,
    allegiance: system?.allegiance,
    needsPermit: toBool(system?.needs_permit ?? system?.permit_required),
    colonised: toBool(system?.is_colonised ?? system?.colonised),
    economy: system?.primary_economy ?? system?.economy,
    bodies: bodies.length || toNum(system?.bodies),
    stations: stations.length || toNum(system?.stations),
    planetClass: planetClassFromBodies(bodies),
  };
}

function buildCsvRows(systems) {
  return systems.map((system) => flattenRecord(system));
}

async function handleExport(reference, radius, outputName, coords) {
  const systems = await fetchAllSystems(reference, radius, coords);
  const outputFile = outputName || `systems-spansh-${sanitizeFilename(reference)}-${radius}ly.csv`;
  const csvPath = path.join(PUBLIC_DIR, path.basename(outputFile));

  await fs.mkdir(PUBLIC_DIR, { recursive: true });

  const rows = buildCsvRows(systems);
  const fields = Array.from(
    rows.reduce((set, row) => {
      for (const key of Object.keys(row)) set.add(key);
      return set;
    }, new Set())
  ).sort();

  const csv = Papa.unparse({ fields, data: rows }, { quotes: true });
  await fs.writeFile(csvPath, csv, "utf8");

  return {
    csvUrl: `/${path.basename(csvPath)}`,
    systems: systems.map(mapToSystemRecord),
  };
}

async function handleSystems(reference, radius, coords) {
  const systems = await fetchAllSystems(reference, radius, coords);
  return systems.map(mapToSystemRecord);
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    sendText(res, 400, "Missing request URL.");
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
  const pathname = url.pathname;

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  if (req.method !== "GET") {
    sendText(res, 405, "Only GET is supported.");
    return;
  }

  if (pathname === "/api/spansh/export") {
    try {
      const reference = url.searchParams.get("reference") ?? DEFAULT_REFERENCE;
      const radius = Number(url.searchParams.get("radius") ?? DEFAULT_RADIUS_LY);
      const output = url.searchParams.get("output") ?? undefined;
      const coords = parseCoords(url.searchParams);
      const payload = await handleExport(reference, radius, output, coords);
      sendJson(res, 200, payload);
    } catch (error) {
      sendJson(res, 500, { error: (error instanceof Error ? error.message : String(error)) });
    }
    return;
  }

  if (pathname === "/api/spansh/ping") {
    sendText(res, 200, "pong");
    return;
  }

  if (pathname === "/api/spansh/systems") {
    try {
      const reference = url.searchParams.get("reference") ?? DEFAULT_REFERENCE;
      const radius = Number(url.searchParams.get("radius") ?? DEFAULT_RADIUS_LY);
      const coords = parseCoords(url.searchParams);
      const payload = await handleSystems(reference, radius, coords);
      sendJson(res, 200, { systems: payload });
    } catch (error) {
      sendJson(res, 500, { error: (error instanceof Error ? error.message : String(error)) });
    }
    return;
  }

  sendText(res, 404, "Not found.");
});

const port = Number(process.env.PORT ?? DEFAULT_PORT);
server.listen(port, () => {
  console.log(`Spansh proxy listening on http://localhost:${port}`);
});