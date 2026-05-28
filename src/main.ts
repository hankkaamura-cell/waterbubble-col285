import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { computeGlobalStats, loadSystemsFromCsv, type SystemRecord } from "./systems";

// =========================================================
// [CFG-01] Tuning constants (hier darfst du drehen)
// =========================================================
const CAMERA_FOV = 55;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 20000;

const MARKER_PIXEL_SIZE = 54; // "wie groß wirkt ein Marker am Bildschirm"
const MARKER_BASE_WORLD = 8;  // fallback world size

const DEFAULT_K_NEIGHBORS = 3;
const DEFAULT_LINK_MAX_DIST = 45; // ly (nur als Graph-Heuristik)

const STAR_COUNT = 2000;
const STAR_RADIUS = 2200;

// Economy -> Color Mapping (Legende)
// [MK-02] — hier ist die Farb-Identität fest verdrahtet
const ECON_COLORS: Record<string, string> = {
  "Industrial": "#f5d76e",
  "Extraction": "#ff4b4b",
  "High Tech": "#61bfff",
  "Tourism": "#b57cff",
  "Agriculture": "#55d07a",
  "Refinery": "#ff9a3d",
  "Service": "#8aa0b7",
  "Military": "#ff59c7",
  "Unknown": "#9aa7b2",
};

// =========================================================
// [PLN-10] PlanetClass -> Color Mapping (innerer Ring)
// =========================================================
const PLANET_COLORS: Record<string, string> = {
  "Earth-like World": "#66ffcc", // türkis/grünlich
  "Water World": "#33aaff",      // blau
  "Ammonia World": "#b68cff",    // lila
  "Other": "#8b949e",            // grau
  "Unknown": "#8b949e",
};


// =========================================================
// [UI-00] DOM references
// =========================================================
const canvas = document.getElementById("scene") as HTMLCanvasElement;

const slotCenter = document.getElementById("slotCenter") as HTMLDivElement;

const econList = document.getElementById("econList") as HTMLDivElement;

const statsTitle = document.getElementById("statsTitle") as HTMLDivElement;
const statsRows = document.getElementById("statsRows") as HTMLDivElement;

const tooltip = document.getElementById("tooltip") as HTMLDivElement;

const btnReset = document.getElementById("btnReset") as HTMLButtonElement;
const btnGlobal = document.getElementById("btnGlobal") as HTMLButtonElement;
const btnSystem = document.getElementById("btnSystem") as HTMLButtonElement;
const btnDeselect = document.getElementById("btnDeselect") as HTMLButtonElement;
const consoleButtons    = document.querySelector(".consoleButtons") as HTMLDivElement | null;
const selectCenter      = document.getElementById("selectCenter")   as HTMLSelectElement;
const sliderRadius      = document.getElementById("sliderRadius")   as HTMLInputElement;
const labelRadius       = document.getElementById("labelRadius")    as HTMLSpanElement;
const btnApplyRadius    = document.getElementById("btnApplyRadius") as HTMLButtonElement;

const chkGrid = document.getElementById("chkGrid") as HTMLInputElement;
const chkLinks = document.getElementById("chkLinks") as HTMLInputElement;
const chkDim = document.getElementById("chkDim") as HTMLInputElement;
const chkTooltip = document.getElementById("chkTooltip") as HTMLInputElement;

// =========================================================
// [GFX-01] Three.js base setup
// =========================================================
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = null; // wir wollen Frame + Alpha-Canvas

const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, CAMERA_NEAR, CAMERA_FAR);
camera.position.set(0, 0, 400);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.rotateSpeed = 0.55;
controls.zoomSpeed = 0.9;
controls.panSpeed = 0.85;


// =========================================================
// [GRID-00] World center anchor (Grid bleibt stabil)
// =========================================================
const worldCenter = new THREE.Vector3();

// =========================================================
// [GFX-02A] Resize cache (verhindert unnötige Resizes pro Frame)
// =========================================================
let lastW = 0;
let lastH = 0;

// =========================================================
// [GFX-02] Resize: Canvas exakt auf #slotCenter
//         -> wichtig für korrektes Hover/Click Mapping
// =========================================================
function resizeToSlot() {
  const r = slotCenter.getBoundingClientRect();
  const w = Math.max(10, Math.floor(r.width));
  const h = Math.max(10, Math.floor(r.height));

  if (w === lastW && h === lastH) return; // <- wichtig

  lastW = w;
  lastH = h;

  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}


window.addEventListener("resize", resizeToSlot);

// =========================================================
// [GFX-03] Camera-facing Grid (billboard plane)
// =========================================================
const gridPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(2000, 2000, 1, 1),
  new THREE.MeshBasicMaterial({
    map: makeGridTexture(),
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  })
);
gridPlane.renderOrder = -10;
scene.add(gridPlane);

const tmpDir = new THREE.Vector3();

function updateCameraFacingGrid() {
  // Grid nur in GLOBAL anzeigen (UI sagt: "Grid (GLOBAL)")
  gridPlane.visible = chkGrid.checked;
  if (!gridPlane.visible) return;

  // Grid als HUD: immer vor der Kamera im Sichtfeld
  const dist = 260; // "HUD-Abstand" vor der Kamera

  camera.getWorldDirection(tmpDir);

  // Plane vor die Kamera setzen
  gridPlane.position.copy(camera.position).add(tmpDir.clone().multiplyScalar(dist));

  // Plane schaut zur Kamera (damit es wie Overlay wirkt)
  gridPlane.lookAt(camera.position);

  // Plane so skalieren, dass es das Sichtfeld abdeckt (inkl. etwas Rand)
  const fovRad = (camera.fov * Math.PI) / 180;
  const height = 2 * Math.tan(fovRad / 2) * dist;
  const width = height * camera.aspect;

  // PlaneGeometry ist 2000 x 2000 -> entsprechend skalieren
  const margin = 1.15;
  gridPlane.scale.set((width / 2000) * margin, (height / 2000) * margin, 1);
}



function makeGridTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, c.width, c.height);

  // Grid
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 32; i++) {
    const x = (i / 16) * c.width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, c.height);
    ctx.stroke();

    const y = (i / 16) * c.height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(c.width, y);
    ctx.stroke();
  }

  // stärkere Linien
  ctx.strokeStyle = "rgba(255,255,255,0.26)";
  ctx.lineWidth = 2;
  for (let i = 0; i <= 8; i++) {
    const x = (i / 4) * c.width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, c.height);
    ctx.stroke();

    const y = (i / 4) * c.height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(c.width, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3.5, 3.5);
  return tex;
}

// =========================================================
// [GFX-05] Starfield = echte 3D Points (Parallaxe)
// =========================================================
const stars = makeStarfield();
scene.add(stars);

function makeStarfield(): THREE.Points {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(STAR_COUNT * 3);

  for (let i = 0; i < STAR_COUNT; i++) {
    // random in sphere
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = STAR_RADIUS * (0.35 + 0.65 * Math.random());

    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);

    pos[i * 3 + 0] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;
  }

  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: new THREE.Color(0xffffff),
    size: 1.25,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });

  return new THREE.Points(geo, mat);
}

// =========================================================
// [DATA-00] Runtime state
// =========================================================
type Mode = "GLOBAL" | "SYSTEM";

let mode: Mode = "GLOBAL";
let systems: SystemRecord[] = [];

type Node = {
  sys: SystemRecord;
  sprite: THREE.Sprite;
  neighbors: number[]; // indices
};

let nodes: Node[] = [];
let links: THREE.LineSegments | null = null;

let selectedIndex: number | null = null;

// Raycasting
const raycaster = new THREE.Raycaster();
const mouseNdc = new THREE.Vector2();

type SpanshExportResponse = {
  csvUrl?: string;
  systems: SystemRecord[];
};

type SpanshSystemsResponse = {
  systems: SystemRecord[];
};

// =========================================================
// [SPN-00] Spansh proxy defaults
// =========================================================
const SPANSH_PROXY_BASE = "http://localhost:8787";
const SPANSH_DEFAULT_REFERENCE = "Col 285 Sector FI-J c9-2";
const SPANSH_DEFAULT_RADIUS = 75;
const WATERBUBBLE_API_BASE = (
  (window as unknown as { WATERBUBBLE_API_BASE?: string }).WATERBUBBLE_API_BASE ?? "http://localhost:8000"
).replace(/\/$/, "");


// =========================================================
// [MK-01] Marker texture (feuriger Stern + 2 Ringe)
//         außen: Economy, innen: PlanetClass
// =========================================================
function makeMarkerTexture(econHex: string, planetHex: string): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, c.width, c.height);

  const cx = c.width / 2;
  const cy = c.height / 2;

  // =========================================================
  // [MK-10] Feuriger Stern (Glow + Kern)
  // =========================================================
  const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 56);
  glow.addColorStop(0.0, "rgba(255,255,255,0.95)");
  glow.addColorStop(0.22, "rgba(255,230,180,0.45)");
  glow.addColorStop(0.55, "rgba(255,160,80,0.16)");
  glow.addColorStop(1.0, "rgba(0,0,0,0.0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, 46, 0, Math.PI * 2);
  ctx.fill();

  // Kern
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.beginPath();
  ctx.arc(cx, cy, 7.5, 0, Math.PI * 2);
  ctx.fill();

  // kleine Spikes
  ctx.strokeStyle = "rgba(255,220,160,0.60)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 18, cy);
  ctx.lineTo(cx - 4, cy);
  ctx.moveTo(cx + 4, cy);
  ctx.lineTo(cx + 18, cy);
  ctx.moveTo(cx, cy - 18);
  ctx.lineTo(cx, cy - 4);
  ctx.moveTo(cx, cy + 4);
  ctx.lineTo(cx, cy + 18);
  ctx.stroke();

// =========================================================
// [MK-20] Outer ring (Economy) — kräftig + Kontrastkante
// =========================================================
{
  const R_OUT = 92;
  const R_ECON = 84;

  // dunkle Backing-Kante (macht Farbe sofort “lesbar”)
  ctx.strokeStyle = "rgba(0,0,0,0.65)";
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(cx, cy, R_ECON, 0, Math.PI * 2);
  ctx.stroke();

  // weißer Außenring deutlich zurücknehmen
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, R_OUT, 0, Math.PI * 2);
  ctx.stroke();

  // Economy-Ring: mehr Fläche + stärkeres Glow
  ctx.save();
  ctx.shadowBlur = 18;
  ctx.shadowColor = econHex;

  ctx.strokeStyle = econHex;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(cx, cy, R_ECON, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// =========================================================
// [MK-30] Inner ring (PlanetClass) — kräftig + Kontrastkante
// =========================================================
{
  const R_IN_WHITE = 56;
  const R_PLANET = 48;

  // dunkle Backing-Kante
  ctx.strokeStyle = "rgba(0,0,0,0.65)";
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(cx, cy, R_PLANET, 0, Math.PI * 2);
  ctx.stroke();

  // Separator weiß zurücknehmen
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, R_IN_WHITE, 0, Math.PI * 2);
  ctx.stroke();

  // Planet-Ring: mehr Fläche + Glow
  ctx.save();
  ctx.shadowBlur = 14;
  ctx.shadowColor = planetHex;

  ctx.strokeStyle = planetHex;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(cx, cy, R_PLANET, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}


  // =========================================================
  // [MK-40] Crosshair (Economy) — sichtbar, aber nicht dominant
  // =========================================================
  ctx.strokeStyle = econHex;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx - 110, cy);
  ctx.lineTo(cx - 72, cy);
  ctx.moveTo(cx + 72, cy);
  ctx.lineTo(cx + 110, cy);
  ctx.moveTo(cx, cy - 110);
  ctx.lineTo(cx, cy - 72);
  ctx.moveTo(cx, cy + 72);
  ctx.lineTo(cx, cy + 110);
  ctx.stroke();

  // Center dot (über dem Glow)
  ctx.fillStyle = "rgba(255,255,255,0.80)";
  ctx.beginPath();
  ctx.arc(cx, cy, 3.0, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}



// =========================================================
// [FLT-01] Economy filter UI + active set
// =========================================================
const econEnabled = new Map<string, boolean>();

function buildEconomyList() {
  const keys = Object.keys(ECON_COLORS);

  econList.innerHTML = "";
  for (const k of keys) {
    econEnabled.set(k, true);

    const row = document.createElement("div");
    row.className = "econItem";

    const left = document.createElement("div");
    left.className = "econLeft";

    const dot = document.createElement("div");
    dot.className = "dot";
    dot.style.background = ECON_COLORS[k];

    const name = document.createElement("div");
    name.className = "econName";
    name.textContent = k;

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "econ";
    cb.checked = true;
    cb.addEventListener("change", () => {
      econEnabled.set(k, cb.checked);
      applyFilters();
    });

    left.appendChild(dot);
    left.appendChild(name);

    row.appendChild(left);
    row.appendChild(cb);
    econList.appendChild(row);
  }
}

function economyKeyOf(sys: SystemRecord): string {
  const raw = (sys.economy ?? "Unknown").trim();
  return ECON_COLORS[raw] ? raw : "Unknown";
}

// =========================================================
// [PLN-11] PlanetClass key helper
// =========================================================
function planetKeyOf(sys: SystemRecord): string {
  const raw = (sys.planetClass ?? "Other").trim();
  return PLANET_COLORS[raw] ? raw : "Other";
}

function applyFilters() {
  for (const n of nodes) {
    const k = economyKeyOf(n.sys);
    const ok = econEnabled.get(k) ?? true;
    n.sprite.visible = ok;
  }
  if (links) links.visible = chkLinks.checked;
}

// =========================================================
// [GRAPH-00] Clear graph (Sprites + Links)
// =========================================================
function resetGraph() {
  for (const n of nodes) {
    scene.remove(n.sprite);
    const mat = n.sprite.material as THREE.SpriteMaterial;
    mat.map?.dispose();
    mat.dispose();
  }
  nodes = [];

  if (links) {
    scene.remove(links);
    links.geometry.dispose();
    (links.material as THREE.Material).dispose();
    links = null;
  }

  systems = [];
  selectedIndex = null;
  mode = "GLOBAL";
}

// =========================================================
// [GRAPH-01] Build neighbor links (kNN + maxDist)
// =========================================================
function buildGraph() {
  const pts = systems.map((s) => new THREE.Vector3(s.x, s.y, s.z));

  nodes = systems.map((sys, i) => {
    const econK = economyKeyOf(sys);
const planetK = planetKeyOf(sys);

const econCol = ECON_COLORS[econK] ?? ECON_COLORS["Unknown"];
const planetCol = PLANET_COLORS[planetK] ?? PLANET_COLORS["Other"];

const tex = makeMarkerTexture(econCol, planetCol);


    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        opacity: 1.0,
      })
    );

    sprite.position.set(sys.x, sys.y, sys.z);
    sprite.userData = { index: i };

    scene.add(sprite);

    return { sys, sprite, neighbors: [] };
  });

  // find neighbors
  for (let i = 0; i < nodes.length; i++) {
    const dists: Array<{ j: number; d: number }> = [];
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      const d = pts[i].distanceTo(pts[j]);
      if (d <= DEFAULT_LINK_MAX_DIST) dists.push({ j, d });
    }
    dists.sort((a, b) => a.d - b.d);
    nodes[i].neighbors = dists.slice(0, DEFAULT_K_NEIGHBORS).map((x) => x.j);
  }

  rebuildLinks();
  applyFilters();
}

// =========================================================
// [GFX-04] Links rendering
// =========================================================
function rebuildLinks() {
  if (links) {
    scene.remove(links);
    links.geometry.dispose();
    (links.material as THREE.Material).dispose();
    links = null;
  }

  const positions: number[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i].sprite.position;
    for (const j of nodes[i].neighbors) {
      if (j < i) continue; // avoid duplicates
      const b = nodes[j].sprite.position;
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

  const mat = new THREE.LineBasicMaterial({
    color: new THREE.Color(0x9cc8ff),
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });

  links = new THREE.LineSegments(geo, mat);
  links.visible = chkLinks.checked;
  scene.add(links);
}

// =========================================================
// [CAM-01] Default framing: center + distance
// =========================================================
function frameAll() {
  if (!nodes.length) return;

  const box = new THREE.Box3();
  for (const n of nodes) box.expandByPoint(n.sprite.position);

  const center = new THREE.Vector3();
  box.getCenter(center);

// [GRID-00] Merken, wo “die Mitte der Szene” ist (für stabiles Grid)
  worldCenter.copy(center);

  
  const size = new THREE.Vector3();
  box.getSize(size);
  const radius = Math.max(size.x, size.y, size.z) * 0.65 + 80;

  controls.target.copy(center);

  // Kamera etwas „schräg“ für 3D Gefühl
  camera.position.copy(center).add(new THREE.Vector3(radius, radius * 0.65, radius * 1.15));
  camera.lookAt(center);
  controls.update();
}

// =========================================================
// [SEL-01] Picking helper (Pointer + Mouse kompatibel)
// =========================================================
function pointerToNdc(evt: PointerEvent | MouseEvent) {
  const r = canvas.getBoundingClientRect();
  const x = (evt.clientX - r.left) / r.width;
  const y = (evt.clientY - r.top) / r.height;
  mouseNdc.set(x * 2 - 1, -(y * 2 - 1));
}

function pick(evt: PointerEvent | MouseEvent): number | null {
  pointerToNdc(evt);

  raycaster.setFromCamera(mouseNdc, camera);
  const sprites = nodes.map((n) => n.sprite);
  const hits = raycaster.intersectObjects(sprites, false);
  if (!hits.length) return null;

  const idx = (hits[0].object as THREE.Sprite).userData.index as number | undefined;
  return typeof idx === "number" ? idx : null;
}


canvas.addEventListener("pointerdown", (evt) => {
  const idx = pick(evt);
  if (idx === null) return;

  selectedIndex = idx;
  mode = "SYSTEM";
  updateModeButtons();
  renderStats();
  applySelectionDimming();

  
});
// =========================================================
// [CAM-04] Focus by double click (kein nerviges Springen bei Single-Click)
// =========================================================
canvas.addEventListener("dblclick", (evt) => {
  const idx = pick(evt);
  if (idx === null) return;

  selectedIndex = idx;
  mode = "SYSTEM";
  updateModeButtons();
  renderStats();
  applySelectionDimming();

  focusSelected(idx);
});

canvas.addEventListener("pointermove", (evt) => {
  if (!chkTooltip.checked) {
    tooltip.hidden = true;
    return;
  }

  const idx = pick(evt);
  if (idx === null) {
    tooltip.hidden = true;
    return;
  }

  const s = nodes[idx].sys;
  tooltip.textContent = `${s.name} — ${economyKeyOf(s)}`;
  tooltip.hidden = false;

  // [HOV-02] Tooltip position: fixed in screen coords
  const pad = 12;
  tooltip.style.left = `${evt.clientX + pad}px`;
  tooltip.style.top = `${evt.clientY + pad}px`;
});

// =========================================================
// [SEL-02] Deselect
// =========================================================
btnDeselect.addEventListener("click", () => {
  selectedIndex = null;
  mode = "GLOBAL";
  updateModeButtons();
  renderStats();
  applySelectionDimming();
});

// =========================================================
// [SEL-03] Mode switching
// =========================================================
btnGlobal.addEventListener("click", () => {
  mode = "GLOBAL";
  updateModeButtons();
  renderStats();
  applySelectionDimming();
});

btnSystem.addEventListener("click", () => {
  mode = "SYSTEM";
  updateModeButtons();
  renderStats();
  applySelectionDimming();
});

btnReset.addEventListener("click", () => {
  // [CAM-02]
  if (selectedIndex !== null && mode === "SYSTEM") focusSelected(selectedIndex);
  else frameAll();
});

// =========================================================
// [UI-01] Update button highlight
// =========================================================
function updateModeButtons() {
  btnGlobal.classList.toggle("btnPrimary", mode === "GLOBAL");
  btnSystem.classList.toggle("btnPrimary", mode === "SYSTEM");
}

// =========================================================
// [SPN-01] Spansh proxy loader button
// =========================================================
// =========================================================
// [SPN-01] Spansh proxy loader button
// =========================================================
function showProxyError(message: string) {
  console.error(message);
  statsTitle.textContent = "ERROR";
  statsRows.innerHTML = `<div style="padding:10px;color:rgba(255,255,255,0.8)">${message}</div>`;
}


type BackendSystemRecord = {
  name?: unknown;
  n?: unknown;
  x?: unknown;
  y?: unknown;
  z?: unknown;
  economy?: unknown;
  ec?: unknown;
  colonised?: unknown;
  col?: unknown;
  faction?: unknown;
  fac?: unknown;
  allegiance?: unknown;
  al?: unknown;
  factionState?: unknown;
  faction_state?: unknown;
  fs?: unknown;
  planetClass?: unknown;
  planet_class?: unknown;
  pc?: unknown;
  bodies?: unknown;
  body_count?: unknown;
  bo?: unknown;
  stations?: unknown;
  station_count?: unknown;
  st?: unknown;
};

function valueToNumber(value: unknown): number | undefined {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function valueToBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const text = String(value ?? "").trim().toLowerCase();
  if (["true", "yes", "1"].includes(text)) return true;
  if (["false", "no", "0"].includes(text)) return false;
  return undefined;
}

function valueToString(value: unknown): string | undefined {
  const text = String(value ?? "").trim();
  return text ? text : undefined;
}

function normalizeBackendSystem(row: BackendSystemRecord): SystemRecord | null {
  const name = valueToString(row.name ?? row.n);
  const x = valueToNumber(row.x);
  const y = valueToNumber(row.y);
  const z = valueToNumber(row.z);

  if (!name || x === undefined || y === undefined || z === undefined) return null;

  return {
    name,
    x,
    y,
    z,
    economy: valueToString(row.economy ?? row.ec),
    colonised: valueToBoolean(row.colonised ?? row.col),
    faction: valueToString(row.faction ?? row.fac),
    allegiance: valueToString(row.allegiance ?? row.al),
    factionState: valueToString(row.factionState ?? row.faction_state ?? row.fs),
    planetClass: valueToString(row.planetClass ?? row.planet_class ?? row.pc) as SystemRecord["planetClass"],
    bodies: valueToNumber(row.bodies ?? row.body_count ?? row.bo) ?? 0,
    stations: valueToNumber(row.stations ?? row.station_count ?? row.st) ?? 0,
  };
}

async function loadSystemsFromBackend(): Promise<SystemRecord[]> {
  const response = await fetch(`${WATERBUBBLE_API_BASE}/api/systems`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Backend system load failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("Backend system load failed: /api/systems did not return an array");
  }

  return payload
    .map((row: BackendSystemRecord) => normalizeBackendSystem(row))
    .filter((system): system is SystemRecord => system !== null);
}

async function loadInitialSystems(): Promise<SystemRecord[]> {
  try {
    const backendSystems = await loadSystemsFromBackend();
    if (backendSystems.length > 0) {
      console.info(`[WaterBubble] Loaded ${backendSystems.length} systems from backend API`);
      return backendSystems;
    }
    console.warn("[WaterBubble] Backend returned zero systems; falling back to static CSV");
  } catch (error) {
    console.warn("[WaterBubble] Backend unavailable; falling back to static CSV", error);
  }

  const csvSystems = await loadSystemsFromCsv("/systems-search-Waterbubble.csv");
  console.info(`[WaterBubble] Loaded ${csvSystems.length} systems from static CSV fallback`);
  return csvSystems;
}

// [RAD-01] Wiederverwendbare Fetch-Funktion (für SPANSH-Button + APPLY-Button)
async function fetchFromSpansh(
  reference: string,
  radiusLy: number,
  shouldExport: boolean,
  triggerBtn: HTMLButtonElement
) {
  triggerBtn.disabled = true;
  const previousLabel = triggerBtn.textContent;
  triggerBtn.textContent = "LOADING...";

  const params = new URLSearchParams({ reference, radius: String(radiusLy) });

  if (shouldExport) {
    const outputName = window.prompt(
      "CSV-Dateiname (optional, wird in /public gespeichert):",
      "systems-spansh.csv"
    );
    if (outputName?.trim()) params.set("output", outputName.trim());
  }

  const endpoint = shouldExport ? "/api/spansh/export" : "/api/spansh/systems";
  const url = `${SPANSH_PROXY_BASE}${endpoint}?${params.toString()}`;

  try {
    const data = await fetchProxyJson(url);
    if (data?.error) throw new Error(String(data.error));

    if (shouldExport) {
      const payload = data as SpanshExportResponse;
      applySystems(payload.systems ?? []);
      triggerCsvDownload(payload.csvUrl);
    } else {
      const payload = data as SpanshSystemsResponse;
      applySystems(payload.systems ?? []);
    }
  } catch (error) {
    showProxyError(
      `Spansh Proxy nicht erreichbar oder Fehler: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  } finally {
    triggerBtn.disabled = false;
    triggerBtn.textContent = previousLabel;
  }
}

function sanitizeSystems(input: SystemRecord[]): SystemRecord[] {
  return input
    .filter((s) => s.name && Number.isFinite(s.x) && Number.isFinite(s.y) && Number.isFinite(s.z))
    .map((s) => ({
      ...s,
      planetClass: s.planetClass ?? "Other",
      economy: s.economy ?? "Unknown",
    }));
}

function populateCenterDropdown(loadedSystems: SystemRecord[]) {
  const current = selectCenter.value;
  selectCenter.innerHTML = "";
  const defaultOpt = document.createElement("option");
  defaultOpt.value = SPANSH_DEFAULT_REFERENCE;
  defaultOpt.textContent = SPANSH_DEFAULT_REFERENCE;
  selectCenter.appendChild(defaultOpt);
  const others = loadedSystems
    .map((s) => s.name)
    .filter((n) => n !== SPANSH_DEFAULT_REFERENCE)
    .sort();
  for (const name of others) {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    selectCenter.appendChild(opt);
  }
  if ([...selectCenter.options].some((o) => o.value === current)) {
    selectCenter.value = current;
  }
}

function buildRadiusControl() {
  sliderRadius.addEventListener("input", () => {
    labelRadius.textContent = `${sliderRadius.value} ly`;
  });
  btnApplyRadius.addEventListener("click", async () => {
    const reference = selectCenter.value || SPANSH_DEFAULT_REFERENCE;
    const radius = Math.min(75, Math.max(1, Number(sliderRadius.value)));
    await fetchFromSpansh(reference, radius, false, btnApplyRadius);
  });
}

function applySystems(newSystems: SystemRecord[]) {
  resetGraph();
  systems = sanitizeSystems(newSystems);
  buildGraph();
  frameAll();
  mode = "GLOBAL";
  updateModeButtons();
  renderStats();
  populateCenterDropdown(systems); // [RAD-02] Dropdown aktualisieren
}


function triggerCsvDownload(csvUrl?: string) {
  if (!csvUrl) return;
  const link = document.createElement("a");
  link.href = csvUrl.startsWith("/") ? csvUrl : `/${csvUrl}`;
  link.download = "";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function fetchProxyJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Proxy Fehler: ${res.status} ${res.statusText} - ${text}`);
  }
  return res.json();
}

function createSpanshButton() {
  if (!consoleButtons) return;

  const btn = document.createElement("button");
  btn.className = "btn";
  btn.textContent = "SPANSH";
  btn.title = "Spansh: Systeme laden (optional CSV export)";
  btn.disabled = true;

  btn.addEventListener("click", async () => {
    const shouldExport = window.confirm("CSV Export über den Proxy starten?");
    await fetchFromSpansh(SPANSH_DEFAULT_REFERENCE, SPANSH_DEFAULT_RADIUS, shouldExport, btn);
  });


  consoleButtons.appendChild(btn);
  enableButtonWhenProxyReady(btn);
}

async function checkProxyHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${SPANSH_PROXY_BASE}/api/spansh/ping`);
    if (!res.ok) return false;
    const text = await res.text();
    return text.trim().toLowerCase() === "pong";
  } catch {
    return false;
  }
}

function enableButtonWhenProxyReady(btn: HTMLButtonElement) {
  const maxAttempts = 10;
  let attempts = 0;

  const tick = async () => {
    attempts += 1;
    const healthy = await checkProxyHealth();
    if (healthy) {
      btn.disabled = false;
      btn.textContent = "SPANSH";
      return;
    }

    if (attempts >= maxAttempts) {
      btn.textContent = "SPANSH (OFFLINE)";
      return;
    }

    btn.textContent = "SPANSH (WAIT)";
    setTimeout(tick, 1500);
  };

  void tick();
}

// =========================================================
// [SEL-04] Dimming logic
// =========================================================
function applySelectionDimming() {
  const dim = chkDim.checked && selectedIndex !== null;

  // Reset all
  for (const n of nodes) {
    const mat = n.sprite.material as THREE.SpriteMaterial;
    mat.opacity = 1.0;
  }

  if (!dim || selectedIndex === null) return;

  const keep = new Set<number>([selectedIndex]);
  for (const j of nodes[selectedIndex].neighbors) keep.add(j);

  for (let i = 0; i < nodes.length; i++) {
    if (keep.has(i)) continue;
    const mat = nodes[i].sprite.material as THREE.SpriteMaterial;
    mat.opacity = 0.18;
  }
}

// =========================================================
// [CAM-03] Focus selected
// =========================================================
function focusSelected(idx: number) {
  const p = nodes[idx].sprite.position.clone();

  // Offset (Kamera relativ zum aktuellen Target) merken
  const offset = camera.position.clone().sub(controls.target);

  // Target auf neues System setzen
  controls.target.copy(p);

  // Kamera mit gleichem Offset "mitnehmen" -> kein Zoom-Sprung
  camera.position.copy(p).add(offset);

  camera.lookAt(p);
  controls.update();
}


// =========================================================
// [STATS-02] Stats rendering
// =========================================================
function renderStats() {
  statsRows.innerHTML = "";

  if (selectedIndex !== null) {
    statsTitle.textContent = "STATISTICS (SELECTED)";
    const s = nodes[selectedIndex].sys;

    addRow("Name", s.name);
    addRow("Economy", economyKeyOf(s));
    addRow("Faction", s.faction ?? "Unknown");
    addRow("Allegiance", s.allegiance ?? "Unknown");
    addRow("Faction State", s.factionState ?? "Unknown");
    addRow("Colonised", String(!!s.colonised));
    addRow("Permit Needed", String(!!s.needsPermit));
    addRow("Bodies", String(s.bodies ?? 0));
    addRow("Stations", String(s.stations ?? 0));
    return;
  }

  statsTitle.textContent = "STATISTICS";
  const g = computeGlobalStats(systems);

  addHeader("GLOBAL OVERVIEW");
  addRow("Systems", String(g.systems));
  addRow("Colonised", String(g.colonised));
  addRow("Permit Needed", String(g.permitNeeded));
  addRow("Bodies (sum)", String(g.bodiesSum));
  addRow("Stations (sum)", String(g.stationsSum));
  addRow("Top Economy", g.topEconomy ?? "Unknown");
  addRow("Top Allegiance", g.topAllegiance ?? "Unknown");
  addRow("Top Faction", g.topFaction ?? "Unknown");

  function addHeader(txt: string) {
    const d = document.createElement("div");
    d.style.margin = "10px 0 6px";
    d.style.fontSize = "11px";
    d.style.letterSpacing = "0.06em";
    d.style.color = "rgba(255,255,255,0.55)";
    d.style.textTransform = "uppercase";
    d.textContent = txt;
    statsRows.appendChild(d);
  }

  function addRow(k: string, v: string) {
    const row = document.createElement("div");
    row.className = "statsRow";
    const kk = document.createElement("div");
    kk.className = "statsKey";
    kk.textContent = k;

    const vv = document.createElement("div");
    vv.className = "statsVal";
    vv.textContent = v;

    row.appendChild(kk);
    row.appendChild(vv);
    statsRows.appendChild(row);
  }
}


// =========================================================
// [MK-03] Marker pixel-size stabilization (Zoom feel)
// =========================================================
function updateMarkerScales() {
  const heightPx = renderer.domElement.height;
  const fovRad = (camera.fov * Math.PI) / 180;

  for (const n of nodes) {
    const dist = camera.position.distanceTo(n.sprite.position);
    const worldPerPx = (2 * Math.tan(fovRad / 2) * dist) / heightPx;
    const worldSize = Math.max(MARKER_BASE_WORLD, worldPerPx * MARKER_PIXEL_SIZE);
    n.sprite.scale.set(worldSize, worldSize, 1);
  }
}

// =========================================================
// [UI-02] Checkbox wiring
// =========================================================
chkGrid.addEventListener("change", () => {
  gridPlane.visible = chkGrid.checked;
});

chkLinks.addEventListener("change", () => {
  if (links) links.visible = chkLinks.checked;
});

chkDim.addEventListener("change", () => {
  applySelectionDimming();
});

chkTooltip.addEventListener("change", () => {
  tooltip.hidden = true;
});

// =========================================================
// [BOOT-01] Load + build scene
// =========================================================
async function bootstrap() {
  createSpanshButton();
  buildEconomyList();
  buildRadiusControl();
  resizeToSlot();

  const initialSystems = await loadInitialSystems();
  applySystems(initialSystems);

  tick();
}

bootstrap().catch((e) => {
  console.error(e);
  statsTitle.textContent = "ERROR";
  statsRows.innerHTML = `<div style="padding:10px;color:rgba(255,255,255,0.8)">Initial data load failed: ${String(
    (e as Error).message ?? e
  )}</div>`;
});

// =========================================================
// [LOOP-01] Render loop
// =========================================================
function tick() {
  requestAnimationFrame(tick);

  resizeToSlot();
  controls.update();

  updateCameraFacingGrid();
  updateMarkerScales();

  // Links ggf. aus
  if (links) links.visible = chkLinks.checked;

  renderer.render(scene, camera);
}
