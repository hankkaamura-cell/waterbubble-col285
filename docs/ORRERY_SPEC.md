# Orrery View – Technical Specification

> System detail view for the Water Bubble star map.
> Status: draft — reviewed 2026-05-30, open questions noted inline.
> Author: Hank Kaamura
> For: FraggertheBoss

---

## Context

The existing application shows Elite Dangerous systems as markers in a 3D bubble map. This spec describes an additional detail mode: when the user clicks a system, the bubble view fades and a stylised, holographic mini-orrery opens showing the bodies and stations of that system.

The representation is deliberately **not** astronomically accurate. The goal is a readable, technical, HUD-style system view — inspired by the Future UI solar system template at `https://future-ui-jet.vercel.app/`. Look, interaction and data structure matter. Physical simulation does not.

---

## Desired behaviour

1. User sees the existing galaxy / bubble / system selection view.
2. User clicks a system.
3. The application identifies the clicked system via raycaster.
4. Bodies and stations are loaded for that system.
5. The galaxy view is hidden or strongly reduced.
6. The camera moves into system detail mode.
7. The detail mode shows a stylised orrery / HUD view:
   - central star or stars
   - planets as glowing, abstracted spheres or glyphs
   - moons as smaller glyphs near their parent planets
   - rings as transparent line rings
   - stations as technical markers / glyphs
   - hover and click interaction for details
8. User can return to the galaxy / bubble view.

---

## Key findings from the visual reference

The Future UI template (`future-ui-jet.vercel.app`) is a bundled JavaScript / HTML artefact of a Three.js web application. The code is not clean source — it is a minified export. It is **not open source** and must not be copied or used as a code base. Use it as a visual and interaction reference only.

Architecture visible from the reference:
- Three.js as the 3D engine
- `Scene`, `PerspectiveCamera`, `OrbitControls`, `WebGLRenderer`
- `canvas.webgl` as render target
- Camera positioned at an angle, not orthogonal
- Objects generated from a data list
- `SphereGeometry` for planets
- `ShaderMaterial` for the holographic look — own vertex and fragment shaders, transparency, `AdditiveBlending`, `uTime` uniform
- Hover and click via `THREE.Raycaster`
- On hover: hovered object scales up
- On click: navigation to a planet page (e.g. `Earth.html`, `Mars.html`)

**This page navigation must not be carried over.** In this project, a click on a system object opens a detail panel within the same view — not a new page.

---

## Target architecture

### Recommended folder structure

```
src/
  main.js
  state/
    viewState.js
  views/
    galaxyView.js
    systemView.js
  services/
    edsmClient.js
    systemCache.js
  rendering/
    materials.js
    glyphs.js
    cameraTransitions.js
    raycasting.js
  data/
    selectedSystems.json
  shaders/
    holographicBody.vert
    holographicBody.frag
    stationGlyph.vert
    stationGlyph.frag
```

### Core principle

The galaxy view and the system detail view are two separate `THREE.Group` objects within the same scene. No page navigation, no hard reload.

```js
const galaxyGroup = new THREE.Group()
const systemGroup = new THREE.Group()

scene.add(galaxyGroup)
scene.add(systemGroup)

systemGroup.visible = false
```

The switch between views happens by toggling the view state, not by loading a new page.

### View state

```js
const viewState = {
  mode: 'galaxy', // 'galaxy' | 'transition' | 'system'
  selectedSystem: null,
  hoveredObject: null,
  systemDetails: null
}
```

---

## Data sources

### 1. Bodies of a system

```
GET https://www.edsm.net/api-system-v1/bodies?systemName=<SYSTEMNAME>
```

Returns among other things:
- `system id`, `system name`
- `bodies[]`
- `body.type` — e.g. `Star` or `Planet`
- `body.subType` — e.g. `B (Blue-White) Star`, `Class IV gas giant`
- `body.distanceToArrival`
- `body.isMainStar`, `body.isScoopable`, `body.isLandable`
- `body.gravity`, `body.earthMasses`, `body.radius`
- `body.surfaceTemperature`, `body.atmosphereType`, `body.volcanismType`
- `body.terraformingState`, `body.orbitalPeriod`, `body.semiMajorAxis`
- `body.orbitalInclination`, `body.rings[]`

### 2. Stations of a system

```
GET https://www.edsm.net/api-system-v1/stations?systemName=<SYSTEMNAME>
```

Returns among other things:
- `stations[]`
- `station.name`, `station.type` — e.g. `Coriolis Starport`, `Planetary settlement`
- `station.distanceToArrival`
- `station.allegiance`, `station.government`, `station.economy`
- `station.haveMarket`, `station.haveShipyard`
- `station.controllingFaction`

### 3. Optional: system information

```
GET https://www.edsm.net/api-v1/system?systemName=<SYSTEMNAME>&showCoordinates=1&showInformation=1&showPrimaryStar=1
```

Not required for the detail view itself but useful for header panels and colour coding.

> **⚠️ Open question for Fragger — CORS and API access strategy**
>
> This spec recommends direct `fetch()` calls from the browser to the EDSM API. This works today, but EDSM has changed its CORS policy in the past. The existing FastAPI backend could act as a proxy instead, which would be more robust and would allow caching at the server level. Fragger should decide: direct browser → EDSM, or browser → FastAPI proxy → EDSM.

---

## Caching

Live loading on click is appropriate for a click-based detail mode. A cache must be used so repeated visits to the same system do not trigger new API requests every time.

Recommended minimum:

```js
const systemDetailCache = new Map()

async function loadSystemDetails(systemName) {
  if (systemDetailCache.has(systemName)) {
    return systemDetailCache.get(systemName)
  }

  const encoded = encodeURIComponent(systemName)

  const [bodiesResponse, stationsResponse] = await Promise.all([
    fetch(`https://www.edsm.net/api-system-v1/bodies?systemName=${encoded}`),
    fetch(`https://www.edsm.net/api-system-v1/stations?systemName=${encoded}`)
  ])

  if (!bodiesResponse.ok) {
    throw new Error(`Could not load bodies for ${systemName}`)
  }

  if (!stationsResponse.ok) {
    throw new Error(`Could not load stations for ${systemName}`)
  }

  const bodiesData = await bodiesResponse.json()
  const stationsData = await stationsResponse.json()

  const detail = normalizeSystemDetails(systemName, bodiesData, stationsData)
  systemDetailCache.set(systemName, detail)
  return detail
}
```

Optional extensions: `localStorage` or `IndexedDB` for persistence across sessions.

---

## Normalised data model

The render logic should not work directly with raw EDSM responses. An internal model keeps the rendering layer clean.

```js
const systemDetail = {
  name: 'Sol',
  source: 'EDSM',
  loadedAt: '2026-05-30T00:00:00.000Z',
  stars: [],
  planets: [],
  moons: [],
  stations: []
}
```

**Body:**

```js
{
  id: 123,
  name: 'Sol 3',
  label: 'Earth',
  type: 'Planet',
  subType: 'Earth-like world',
  distanceToArrival: 504,
  isLandable: false,
  radius: 6378,
  earthMasses: 1,
  surfaceTemperature: 288,
  atmosphereType: 'Suitable for water-based life',
  volcanismType: 'No volcanism',
  terraformingState: 'Terraformable',
  rings: [],
  parentName: null,
  render: {
    radius: 4.2,
    angle: 1.72,
    size: 0.14,
    color: '#66aaff',
    glyph: 'planet'
  }
}
```

**Station:**

```js
{
  id: 7821,
  name: 'Garratt Ring',
  type: 'Coriolis Starport',
  distanceToArrival: 977,
  allegiance: 'Federation',
  government: 'Confederacy',
  economy: 'Industrial',
  haveMarket: true,
  haveShipyard: true,
  controllingFaction: 'Coalition of Achali',
  render: {
    radius: 4.8,
    angle: 2.31,
    size: 0.16,
    color: '#ffaa33',
    glyph: 'coriolis'
  }
}
```

> The `render` properties are artificial and calculated for display. They are not real astronomical coordinates.

---

## Normalising bodies

EDSM returns `type = Star` or `type = Planet`. Moons also appear as `Planet` type with naming conventions. The full hierarchy is not always available as a ready-made tree. Heuristics are sufficient for the first version:

1. **Stars:** `body.type === 'Star'`
2. **Planets:** `body.type === 'Planet'` and name does not look like a moon
3. **Moons:** `body.type === 'Planet'` and name looks like a moon — e.g. lower-case letter suffix or deeper name structure

Examples from Elite Dangerous:
- `Sol 3` = planet
- `Sol 3 a` = moon
- `Sol 3 a 1` = sub-body / further hierarchy possible

The moon hierarchy should be robust but not perfect. For the visual representation:
- Main bodies arranged on orbit rings
- Moons grouped near their parent body if a parent can be derived
- If no parent can be derived, moons are shown as small planets on their own positions

---

## Stylised positioning

The system view is not realistic. Therefore:

- `distanceToArrival` is used only as ordering and spacing information
- Distances are logarithmically transformed
- Angles are generated deterministically from names so the view looks the same on every visit
- Sizes are capped categorically

```js
function displayRadiusFromDistance(distanceToArrival, index) {
  const fallbackDistance = (index + 1) * 500
  const d = Math.max(distanceToArrival ?? fallbackDistance, 1)
  return 1.2 + Math.log10(d + 1) * 1.8
}

function hashAngle(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0
  }
  return (h / 4294967295) * Math.PI * 2
}

function positionOnStylisedOrbit(item, index) {
  const r = displayRadiusFromDistance(item.distanceToArrival, index)
  const a = hashAngle(item.name)

  return new THREE.Vector3(
    Math.cos(a) * r,
    0,
    Math.sin(a) * r
  )
}
```

> **⚠️ Open question for Fragger — hashAngle clustering**
>
> Col 285 system names are structurally very similar (e.g. `Col 285 Sector KQ-S b18-0`, `Col 285 Sector KQ-S b18-3`). The `hashAngle` function may produce visually clustered angles for bodies within these systems because their names share long common prefixes. Worth testing early with real Water Bubble system data and adjusting the hash if needed.

---

## Categorical sizes

Do not use real-scale sizing. Real sizes would destroy readability.

| Object type | Recommended size |
|---|---|
| Star (main) | 0.45 – 0.70 |
| White dwarf / neutron star | 0.30 – 0.40, brighter effect |
| Gas giant | 0.20 – 0.28 |
| Earth-like / water world / ammonia world | 0.14 – 0.18 |
| Landable rocky / icy body | 0.10 – 0.13 |
| Moon | 0.045 – 0.08 |
| Station | 0.10 – 0.18 depending on type |
| Fleet Carrier | 0.18 – 0.24 |

---

## Colour coding

Colours should be semantic but not naturalistic.

**Stars:**
- O/B: blue-white
- A/F: white to light blue
- G/K: yellow to orange
- M: red-orange
- White dwarf: cold white/blue
- Neutron star: light blue/violet
- Black hole: dark marker with glowing ring

**Planets:**

> **⚠️ Open question for Fragger — colour conflict with existing main.ts**
>
> The existing `main.ts` defines Ammonia World as `#b68cff` (purple/violet). This spec lists Ammonia World as "greenish". One definition must win. Recommendation: align the orrery colour scheme with the existing bubble map colours for visual consistency. The bubble map colours are the established reference.

- Earth-like world: blue/cyan
- Water world: cyan/blue
- Ammonia world: **see note above — align with `main.ts`**
- High metal content: orange/ochre
- Metal-rich: red/orange
- Rocky body: grey/ochre
- Icy body: light blue/grey
- Gas giant: violet/blue/orange depending on subtype

**Stations:**
- Starport with market: orange/gold
- Station with shipyard: brighter orange or additional ring
- Outpost: blue-white
- Planetary settlement: greenish
- Fleet Carrier: magenta/violet or white with distinct silhouette

---

## System view build

```js
function clearSystemView() {
  while (systemGroup.children.length > 0) {
    const child = systemGroup.children.pop()
    child.geometry?.dispose?.()
    child.material?.dispose?.()
  }
}
```

> **⚠️ Open question for Fragger — dispose() and nested children**
>
> The `clearSystemView()` function above disposes direct children of `systemGroup`. However if moons are added as children of planet meshes (rather than directly to `systemGroup`), they will not be disposed by this loop. Three.js recommends using `traverse()` for nested object cleanup. Fragger should verify the final scene graph structure and adjust accordingly.

```js
async function enterSystemView(systemSummary) {
  if (viewState.mode !== 'galaxy') return

  viewState.mode = 'transition'
  viewState.selectedSystem = systemSummary

  const detail = await loadSystemDetails(systemSummary.name)

  clearSystemView()
  buildSystemView(detail)

  galaxyGroup.visible = false
  systemGroup.visible = true

  await zoomCameraToSystemView()

  viewState.mode = 'system'
  viewState.systemDetails = detail
}

function exitSystemView() {
  viewState.mode = 'transition'

  systemGroup.visible = false
  galaxyGroup.visible = true

  zoomCameraToGalaxyView().then(() => {
    viewState.mode = 'galaxy'
    viewState.selectedSystem = null
    viewState.systemDetails = null
  })
}
```

### Build function

```js
function buildSystemView(detail) {
  createSystemRootGrid(detail)

  const mainStar = detail.stars.find(s => s.isMainStar) ?? detail.stars[0]
  createCentralStar(mainStar, detail.name)

  detail.stars
    .filter(star => star !== mainStar)
    .forEach((star, index) => createSecondaryStar(star, index))

  detail.planets.forEach((planet, index) => {
    createOrbitRing(planet, index)
    const planetMesh = createBodyGlyph(planet, index)
    createBodyLabelAnchor(planetMesh, planet)

    const moons = detail.moons.filter(moon => moon.parentName === planet.name)
    createMoonGlyphs(planetMesh, moons)
  })

  detail.stations.forEach((station, index) => {
    createStationGlyph(station, index)
  })
}
```

---

## Central star

```js
function createCentralStar(star, systemName) {
  const geometry = new THREE.SphereGeometry(0.5, 48, 48)
  const material = makeHolographicBodyMaterial(colorForStar(star?.subType), {
    opacity: 0.85,
    fresnelPower: 1.6,
    scanlineStrength: 0.45
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.userData = {
    kind: 'star',
    name: star?.name ?? systemName,
    data: star
  }

  systemGroup.add(mesh)
  interactiveObjects.push(mesh)
  return mesh
}
```

---

## Planet glyph

```js
function createBodyGlyph(body, index) {
  const pos = positionOnStylisedOrbit(body, index)
  const size = sizeForBody(body)

  const geometry = new THREE.SphereGeometry(size, 32, 32)
  const material = makeHolographicBodyMaterial(colorForBody(body), {
    opacity: body.isLandable ? 0.76 : 0.62,
    fresnelPower: 2.0,
    scanlineStrength: 0.35
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.copy(pos)
  mesh.userData = {
    kind: 'body',
    name: body.name,
    data: body
  }

  systemGroup.add(mesh)
  interactiveObjects.push(mesh)

  if (body.rings?.length) {
    createRingGlyph(mesh, body)
  }

  return mesh
}
```

---

## Orbit ring

```js
function createOrbitRing(body, index) {
  const r = displayRadiusFromDistance(body.distanceToArrival, index)

  const curve = new THREE.EllipseCurve(
    0, 0,
    r, r,
    0, Math.PI * 2
  )

  const points = curve.getPoints(192)
  const geometry = new THREE.BufferGeometry().setFromPoints(
    points.map(p => new THREE.Vector3(p.x, 0, p.y))
  )

  const material = new THREE.LineBasicMaterial({
    color: 0x3366ff,
    transparent: true,
    opacity: 0.16,
    depthWrite: false
  })

  const line = new THREE.LineLoop(geometry, material)
  line.userData = {
    kind: 'orbit',
    name: body.name,
    data: body
  }

  systemGroup.add(line)
  return line
}
```

---

## Stations as glyphs

Stations must not look like planets. They appear as technical markers.

Recommended geometries:
- Coriolis Starport: `OctahedronGeometry` or angular polyhedron
- Orbis / Ocellus Starport: `TorusGeometry` or ring with core
- Outpost: `BoxGeometry`, thin technical structure
- Planetary settlement: `ConeGeometry` or small pyramid marker
- Fleet Carrier: elongated box / ship glyph
- Unknown: `TetrahedronGeometry`

```js
function stationGeometryForType(type = '') {
  const t = type.toLowerCase()

  if (t.includes('coriolis')) return new THREE.OctahedronGeometry(1, 0)
  if (t.includes('orbis') || t.includes('ocellus')) return new THREE.TorusGeometry(0.7, 0.12, 8, 32)
  if (t.includes('outpost')) return new THREE.BoxGeometry(1.1, 0.32, 0.32)
  if (t.includes('planetary')) return new THREE.ConeGeometry(0.5, 0.85, 4)
  if (t.includes('fleet carrier')) return new THREE.BoxGeometry(1.5, 0.28, 0.52)

  return new THREE.TetrahedronGeometry(0.75)
}

function createStationGlyph(station, index) {
  const r = displayRadiusFromDistance(station.distanceToArrival, index)
  const a = hashAngle(station.name)

  const geometry = stationGeometryForType(station.type)
  const material = makeStationMaterial(station)

  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(
    Math.cos(a) * r,
    0.25,
    Math.sin(a) * r
  )
  mesh.scale.setScalar(sizeForStation(station))

  mesh.userData = {
    kind: 'station',
    name: station.name,
    data: station
  }

  systemGroup.add(mesh)
  interactiveObjects.push(mesh)

  createStationBracket(mesh, station)

  return mesh
}
```

---

## Raycaster logic

Separate interactive object lists for galaxy view and system view.

```js
const galaxyInteractiveObjects = []
const systemInteractiveObjects = []

window.addEventListener('mousemove', event => {
  updateMousePosition(event, mouse, raycaster, camera)

  if (viewState.mode === 'galaxy') handleGalaxyHover()
  if (viewState.mode === 'system') handleSystemHover()
})

window.addEventListener('click', event => {
  updateMousePosition(event, mouse, raycaster, camera)

  if (viewState.mode === 'galaxy') selectClickedSystem()
  if (viewState.mode === 'system') selectClickedSystemObject()
})

function selectClickedSystem() {
  const intersects = raycaster.intersectObjects(galaxyInteractiveObjects)
  if (intersects.length === 0) return

  const object = intersects[0].object
  const system = object.userData.system

  enterSystemView(system)
}

function selectClickedSystemObject() {
  const intersects = raycaster.intersectObjects(systemInteractiveObjects)
  if (intersects.length === 0) return

  const object = intersects[0].object

  showDetailPanel({
    kind: object.userData.kind,
    name: object.userData.name,
    data: object.userData.data
  })
}
```

---

## Camera transition

The detail view does not zoom from real galaxy coordinates into the system — that would be geometrically and visually impractical. Instead:

1. Click on system.
2. Hide or fade out the galaxy view.
3. Build the `systemGroup` at the origin or a defined detail anchor.
4. Animate the camera to a fixed system view position.

```js
function zoomCameraToSystemView() {
  return animateCamera({
    position: new THREE.Vector3(0, 5.5, 9),
    target: new THREE.Vector3(0, 0, 0),
    duration: 900
  })
}

function zoomCameraToGalaxyView() {
  return animateCamera({
    position: previousGalaxyCameraPosition,
    target: previousGalaxyControlsTarget,
    duration: 900
  })
}

function animateCamera({ position, target, duration }) {
  return new Promise(resolve => {
    const start = performance.now()
    const startPos = camera.position.clone()
    const startTarget = controls.target.clone()

    function frame(now) {
      const t = Math.min((now - start) / duration, 1)
      const k = easeInOutCubic(t)

      camera.position.lerpVectors(startPos, position, k)
      controls.target.lerpVectors(startTarget, target, k)
      controls.update()

      if (t < 1) requestAnimationFrame(frame)
      else resolve()
    }

    requestAnimationFrame(frame)
  })
}

function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2
}
```

---

## Material and shader approach

The visual reference achieves its look via `ShaderMaterial`. A first prototype can use `MeshBasicMaterial` with `AdditiveBlending`. For the full Future UI look, a custom shader is needed in the mid term.

**Minimal prototype:**

```js
function makeHolographicBodyMaterial(color, options = {}) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: options.opacity ?? 0.7,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })
}
```

**Later shader properties:**
- Fresnel rim light
- Horizontal scanlines
- Subtle flicker via `uTime`
- Additive transparency
- Optional glitch / noise offset in the vertex shader
- Varying intensity per object class

---

## Animation loop

The reference updates `uTime` each frame and moves planets along simple circular paths. For Elite Dangerous the approach should differ:

- No real orbital animation required
- Bodies can pulse gently
- Stations can rotate slowly
- Orbit rings can flicker subtly
- Selected objects glow more strongly
- `uTime` passed centrally to all shader materials per frame

```js
const clock = new THREE.Clock()

function tick() {
  const elapsedTime = clock.getElapsedTime()

  updateShaderUniforms(elapsedTime)

  if (viewState.mode === 'system') {
    animateSystemObjects(elapsedTime)
  }

  controls.update()
  renderer.render(scene, camera)
  requestAnimationFrame(tick)
}

function animateSystemObjects(t) {
  systemGroup.children.forEach(child => {
    if (child.userData.kind === 'station') {
      child.rotation.y += 0.004
    }

    if (child.userData.kind === 'body') {
      const pulse = 1 + Math.sin(t * 2 + child.id) * 0.025
      child.scale.setScalar(pulse)
    }
  })
}
```

---

## Interaction design in system mode

**Hover:**
- Object scales up slightly
- Cursor becomes pointer
- Small tooltip with name, type, distance

**Click — detail panel content by object type:**

Star: name, subtype, surface temperature, solar masses, solar radius, is scoopable

Planet / moon: name, subtype, distance to arrival, is landable, gravity, atmosphere type, volcanism type, terraforming state, rings

Station: name, type, distance to arrival, economy, allegiance, government, has market, has shipyard, controlling faction

**Return:**
- ESC or back button in the UI
- Hide / clear `systemGroup`
- Show `galaxyGroup` again
- Camera returns to previous position

---

## HUD / UI layer

Three.js renders the 3D scene. Names, panels and readouts should be implemented as HTML/CSS overlays, not 3D text. This is more performant and more readable.

```html
<div id="hud">
  <button id="backButton">Back to bubble</button>
  <div id="systemTitle"></div>
  <div id="objectTooltip"></div>
  <aside id="detailPanel"></aside>
</div>
```

The HUD should follow Elite Dangerous / Future UI visual logic:
- Dark background
- Fine lines
- Orange / blue accent colours
- Technical panels
- Minimal text in the 3D scene itself

---

## Performance notes

For a few dozen systems and a system detail view with 20–200 objects, normal meshes are fine.

For larger scale:
- Galaxy view: use `THREE.Points` or `InstancedMesh`
- System view: meshes are acceptable since only one system is shown
- Orbit rings as `LineLoop` / `LineSegments`
- Labels as HTML overlay, not `TextGeometry`
- Reuse geometries when many identical glyphs appear
- Reuse materials per category
- On leaving the system view: `dispose()` geometries and materials cleanly if they are not reused

---

## Error cases

The detail view must be robust.

| Case | Handling |
|---|---|
| EDSM returns no bodies | Show central system marker and note: "No body data available" |
| EDSM returns bodies but no stations | Show normal orrery without stations |
| API request fails | Show error in HUD, offer return to galaxy |
| System name contains special characters | Always use `encodeURIComponent(systemName)` |
| System has very many bodies | Optionally reduce, group, or offer a filter |
| System has extreme distanceToArrival values | Use logarithmic scaling and maximum display radii |

---

## METIS integration — CMDR markers in the Orrery View

The Orrery View must be aware of METIS (Project METIS, Phase 1: Location Layer). When one or more CMDRs who have opted in to location sharing are currently in the system being viewed, they should appear as named markers inside the orrery.

### Design principles

- CMDR markers are a distinct visual category — they must never be confused with bodies or stations.
- A CMDR marker is only shown if the CMDR has actively opted in. The frontend renders what the METIS backend provides; it does not make staleness decisions itself.
- The METIS data arrives via the squadron board endpoint. The orrery should poll or subscribe to this on enter, not on every frame.

### Suggested visual treatment

- CMDR markers: small, bright, distinct glyph — not a sphere, not a station shape. A simple diamond or chevron works. Colour: white or a dedicated CMDR colour outside the existing economy/planet palette.
- If the CMDR's last known position includes a station name that matches a station in the orrery, place the CMDR marker near that station.
- If no station match is possible, place the CMDR marker at a neutral orbit position (e.g. slightly above the orbital plane, at a mid-range radius).
- CMDR name shown on hover as a tooltip.
- Click on a CMDR marker shows: CMDR name, last reported location source (API / journal / best-guess), and a timestamp if the data is fresh enough to be meaningful.

### Data flow for the Orrery View

```
enterSystemView(systemSummary)
  → loadSystemDetails(systemName)       // EDSM: bodies + stations
  → loadMetisCmdrsInSystem(systemName)  // METIS backend: CMDRs in this system
  → buildSystemView(detail)
  → buildCmdrMarkers(cmdrs)             // separate pass, separate interactiveObjects list
```

### Separation of concerns

CMDR markers should be built in a separate pass after `buildSystemView()`. They use their own list for raycasting — separate from `systemInteractiveObjects` — so that body/station interaction and CMDR interaction do not interfere.

```js
const cmdrInteractiveObjects = []

function buildCmdrMarkers(cmdrs) {
  for (const cmdr of cmdrs) {
    const marker = createCmdrGlyph(cmdr)
    systemGroup.add(marker)
    cmdrInteractiveObjects.push(marker)
  }
}
```

> **⚠️ Open question for Fragger — METIS endpoint shape**
>
> The METIS backend design (Phase 1) defines a squadron board endpoint that the frontend consumes. The exact JSON shape of that endpoint is not yet confirmed. Before building `loadMetisCmdrsInSystem()`, Fragger should define the response contract — at minimum: CMDR name, system name, station name (nullable), observed_at, source. The orrery integration depends on this shape.

---

## MVP implementation steps

1. Equip existing system objects with `userData.system`
2. Cleanly detect raycaster click on systems
3. Implement `enterSystemView(system)` — initially just `console.log`
4. Build `edsmClient` with `loadSystemDetails(systemName)`
5. Verify bodies and stations in the console
6. Introduce `systemGroup`
7. Build `clearSystemView()` and `buildSystemView(detail)`
8. Render central star and simple planet points
9. Add orbit rings
10. Add stations as simple glyphs
11. Toggle `galaxyGroup` / `systemGroup`
12. Add camera transition
13. Add hover in system mode
14. Add detail panel
15. **Confirm METIS squadron board endpoint shape with Fragger**
16. **Build `loadMetisCmdrsInSystem()` against confirmed endpoint**
17. **Build `buildCmdrMarkers()` and `cmdrInteractiveObjects` raycasting**
18. Improve material / shader look
19. Add return function
20. Add cache
21. Handle error cases

---

## Acceptance criteria for first working version

- A click on a system starts the detail mode, not a page navigation
- Bodies and stations are loaded live or from cache
- At minimum stars, planets and stations are visibly represented
- The representation remains stylised and readable
- `distanceToArrival` influences approximate visual distance, but logarithmically and not to real scale
- Stations are clearly visually distinct from planets
- Hover shows name and type
- Click on an object shows a detail panel
- Return to galaxy view is possible
- The camera moves smoothly into the system view and back
- No hard dependencies on individual planet pages like `Earth.html` or `Mars.html`

---

## Non-goals

- No physically accurate N-body simulation
- No real orbital mechanics
- No to-scale representation of star, planet and station sizes
- No exact spatial placement of stations (EDSM station data does not provide real 3D coordinates)
- No direct copying of the bundled reference code as a project base

---

## Sources and references

- Visual reference: `https://future-ui-jet.vercel.app/` — not open source, concept reference only
- EDSM API Systems v1: `https://www.edsm.net/en/api-v1`
- EDSM API System v1 (bodies and stations): `https://www.edsm.net/en/api-system-v1`
