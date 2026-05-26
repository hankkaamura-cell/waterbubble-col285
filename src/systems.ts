// =========================================================
// [CSV-01] Types + CSV loader
// =========================================================
import Papa from "papaparse";

export type EconomyKey =
  | "Industrial"
  | "Extraction"
  | "High Tech"
  | "Tourism"
  | "Agriculture"
  | "Refinery"
  | "Service"
  | "Military"
  | "Unknown";

export type PlanetClass = "Water World" | "Earth-like World" | "Ammonia World" | "Other";

export type SystemRecord = {
  name: string;
  distanceLy?: number;
  faction?: string;
  factionState?: string;
  allegiance?: string;
  needsPermit?: boolean;
  colonised?: boolean;
  economy?: string;

  // =========================================================
  // [PLN-00] Planet class (für inneren Ring später)
  // =========================================================
  planetClass?: PlanetClass;

  // Bodies/Stations bleiben Zahlen (Counts)
  bodies?: number;
  stations?: number;

  x: number;
  y: number;
  z: number;
};

// =========================================================
// [CSV-02] CSV parsing helpers
// =========================================================
function toNum(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : undefined;
}

function toBool(v: unknown): boolean | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim().toLowerCase();
  if (s === "true" || s === "yes" || s === "1") return true;
  if (s === "false" || s === "no" || s === "0") return false;
  return undefined;
}

// =========================================================
// [CSV-04] JSON fields: Bodies / Stations
//         CSV enthält hier JSON-Listen als Text.
// =========================================================
function toJsonArray(v: unknown): unknown[] {
  if (v === null || v === undefined) return [];
  const s = String(v).trim();
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// =========================================================
// [PLN-01] Detect planet class from Bodies JSON
//         Priorität: Earth-like > Water > Ammonia > Other
// =========================================================
export function planetClassFromBodies(bodies: unknown[]): PlanetClass {
  let hasWater = false;
  let hasAmmonia = false;

  for (const b of bodies) {
    if (!b || typeof b !== "object") continue;
    const body = b as Record<string, unknown>;

    // subtype ist in deinem CSV vorhanden (z.B. "Water world")
    const subtype = String(body["subtype"] ?? "").toLowerCase();

    if (!subtype) continue;

    // robust: wir prüfen per "includes"
    if (subtype.includes("earth-like")) return "Earth-like World";
    if (subtype.includes("earth like")) return "Earth-like World"; // fallback
    if (subtype.includes("water world")) hasWater = true;
    if (subtype.includes("ammonia world")) hasAmmonia = true;
  }

  if (hasWater) return "Water World";
  if (hasAmmonia) return "Ammonia World";
  return "Other";
}

// =========================================================
// [CSV-03] Load CSV from /public (via Vite dev server)
// =========================================================
export async function loadSystemsFromCsv(url: string): Promise<SystemRecord[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CSV fetch failed: ${res.status} ${res.statusText}`);
  const text = await res.text();

  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors?.length) {
    // Nicht hart abbrechen, aber sichtbar machen
    console.warn("CSV parse warnings:", parsed.errors);
  }

  const out: SystemRecord[] = [];
  for (const row of parsed.data) {
    const name = String(row["Name"] ?? "").trim();
    const x = toNum(row["X"]);
    const y = toNum(row["Y"]);
    const z = toNum(row["Z"]);
    if (!name || x === undefined || y === undefined || z === undefined) continue;

    // =========================================================
    // [PLN-02] Bodies/Stations kommen als JSON-Text -> wir zählen
    // =========================================================
    const bodiesArr = toJsonArray(row["Bodies"]);
    const stationsArr = toJsonArray(row["Stations"]);
    const planetClass = planetClassFromBodies(bodiesArr);

    out.push({
      name,
      distanceLy: toNum(row["Distance (LY)"]),
      faction: String(row["Controlling Faction"] ?? "").trim() || undefined,
      needsPermit: toBool(row["Needs Permit"]),
      colonised: toBool(row["Colonised"]),
      economy: String(row["Economy"] ?? "").trim() || undefined,

      // NEU:
      planetClass,

      // FIX: Counts statt toNum(JSON-Text)
      bodies: bodiesArr.length,
      stations: stationsArr.length,

      x,
      y,
      z,
      factionState: String(row["Controlling Faction State"] ?? "").trim() || undefined,
      allegiance: String(row["Allegiance"] ?? "").trim() || undefined,
    });
  }

  return out;
}

// =========================================================
// [STATS-01] Global statistics helper
// =========================================================
export type GlobalStats = {
  systems: number;
  colonised: number;
  permitNeeded: number;
  bodiesSum: number;
  stationsSum: number;
  topEconomy?: string;
  topAllegiance?: string;
  topFaction?: string;
};

function modeString(values: (string | undefined)[]): string | undefined {
  const m = new Map<string, number>();
  for (const v of values) {
    const s = (v ?? "").trim();
    if (!s) continue;
    m.set(s, (m.get(s) ?? 0) + 1);
  }
  let best: string | undefined;
  let bestN = 0;
  for (const [k, n] of m.entries()) {
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  }
  return best;
}

export function computeGlobalStats(systems: SystemRecord[]): GlobalStats {
  const systemsN = systems.length;
  const colonised = systems.filter((s) => s.colonised).length;
  const permitNeeded = systems.filter((s) => s.needsPermit).length;
  const bodiesSum = systems.reduce((a, s) => a + (s.bodies ?? 0), 0);
  const stationsSum = systems.reduce((a, s) => a + (s.stations ?? 0), 0);

  return {
    systems: systemsN,
    colonised,
    permitNeeded,
    bodiesSum,
    stationsSum,
    topEconomy: modeString(systems.map((s) => s.economy)),
    topAllegiance: modeString(systems.map((s) => s.allegiance)),
    topFaction: modeString(systems.map((s) => s.faction)),
  };
}
