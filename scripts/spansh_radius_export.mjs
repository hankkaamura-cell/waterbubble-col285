// Requires Node 18+ (global fetch) and papaparse (npm install papaparse).
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import Papa from "papaparse";

const DEFAULT_RADIUS_LY = 75;
const DEFAULT_REFERENCE = "Col 285 Sector FI-J c9-2";
const API_URL = "https://spansh.co.uk/api/systems/search";
const PAGE_SIZE = 100;
const DEFAULT_OUTPUT = "public/systems-spansh.csv";

function parseArgs(args) {
  const options = {
    reference: DEFAULT_REFERENCE,
    radius: DEFAULT_RADIUS_LY,
    output: DEFAULT_OUTPUT,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--reference" || arg === "-r") {
      options.reference = args[i + 1] ?? options.reference;
      i += 1;
    } else if (arg === "--radius" || arg === "-d") {
      const value = Number(args[i + 1]);
      if (!Number.isNaN(value)) {
        options.radius = value;
      }
      i += 1;
    } else if (arg === "--output" || arg === "-o") {
      options.output = args[i + 1] ?? options.output;
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }
  }

  return options;
}

function printUsage() {
  console.log(`\nSpansh Systemexport (CSV)\n\n` +
    `Usage:\n  node spansh_radius_export.mjs [options]\n\n` +
    `Options:\n` +
    `  -r, --reference <name>  Referenzsystem (Default: ${DEFAULT_REFERENCE})\n` +
    `  -d, --radius <ly>        Radius in Lichtjahren (Default: ${DEFAULT_RADIUS_LY})\n` +
    `  -o, --output <file>      Ausgabedatei (Default: ${DEFAULT_OUTPUT})\n` +
    `  -h, --help               Hilfe anzeigen\n`
  );
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

async function fetchPage(page, reference, radius) {
  const payload = {
    filters: {
      distance: { min: 0, max: radius },
      distance_from: { system: reference },
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
      "User-Agent": "xH20-command-center/1.0 (spansh export script)",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Spansh API Fehler: ${response.status} ${response.statusText} - ${text}`);
  }

  return response.json();
}

async function run() {
  const { reference, radius, output } = parseArgs(process.argv.slice(2));
  const safeName = reference.replace(/[^a-z0-9]+/gi, "-").replace(/(^-|-$)/g, "");
  const outputPath = output || `spansh-systems-${safeName}-${radius}ly.csv`;

  let page = 0;
  let total = 0;
  const rows = [];

  while (true) {
    const data = await fetchPage(page, reference, radius);
    const results = data?.results ?? [];
    total = data?.count ?? total;

    for (const system of results) {
      rows.push(flattenRecord(system));
    }

    page += 1;
    if (rows.length >= total || results.length === 0) {
      break;
    }
  }

  if (rows.length === 0) {
    console.log("Keine Systeme gefunden.");
    return;
  }

  const fields = Array.from(
    rows.reduce((set, row) => {
      for (const key of Object.keys(row)) set.add(key);
      return set;
    }, new Set())
  ).sort();

  const csv = Papa.unparse({ fields, data: rows }, { quotes: true });
  const resolvedOutput = path.resolve(process.cwd(), outputPath);
  await fs.writeFile(resolvedOutput, csv, "utf8");

  console.log(`CSV gespeichert: ${resolvedOutput}`);
  console.log(`Systeme gefunden: ${rows.length}`);
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});