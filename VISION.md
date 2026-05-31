# 🌊 Water Bubble – Project Vision & Roadmap

> *"An interactive, living map of the Elite Dangerous galaxy – starting in Col 285."*

---

## What this started as

A personal side project: a browser-based star map for the Water Bubble colonisation initiative in Col 285. Built with TypeScript, Three.js, Python and a lot of AI assistance. The goal was to stop generate static data manually and replace it with something alive.

---

## What this wants to become

A tool that any Elite Dangerous player can run and use to understand **how a region of the galaxy actually works**. Not just where the systems are, but what's happening inside and between them.
Thats especially importand for colonisation project like "the water bubble".

- What trade relationships exist between systems?
- Where is the Colony expanding?
- Where is it most interesting to colonise next?
- What's being built, what's finished, what's struggling?
- Where are my mates?

The Water Bubble is the starting point. But the architecture should work for **any cluster, any region, any squadron** in the galaxy.

---

## Community knowledge – Water Bubble specifics

Key information from the founding members of the Water Bubble:

**Reference system:**
The geometric median of the bubble is **Tourism c9-33**. All distance calculations should be measured from there.

**System categories (already established in the community, range in LY tba):**
- **Core** – systems close to the median
- **Auxiliary** – mid-range systems
- **Frontier** – outer systems

These map directly to our `role` field and should be reflected in the data layer.

**Canonical system list:**
Currently maintained manually on Discord. Goal: migrate into the data layer so the tool becomes a / the single source of truth.

**What the community is manually tracking today:**
- Population per system
- Number and type of settlements / stations
- Notable price phenomena
- BGS stats

This is exactly the data our tool should absorb and visualise automatically.

**Dedicated webpage:**
There is a community aspiration for a dedicated Water Bubble webpage.

---

## The bigger picture: a platform, not just a tool

Water Bubble is the prototype.

Every organised group of Elite Dangerous players faces the same problems: no shared map, no project history, no way to see what they've collectively built. BGS squadrons, colonisation fleets, exploration groups – they all coordinate in Discord and spreadsheets, with no visual layer that makes their work visible.

This tool can change that. For any group, not just Water Bubble.

The key insight: **the code knows nothing about Water Bubble specifically**. It knows about systems, factions, economies, trade, and status. Water Bubble is just a configuration. Any group can bring their own.

This shapes every UX and UI decision from here on.

### 🎨 Group configuration (not hardcoded)
- Group name, logo, and colour palette defined in `config.json`
- Reference system, default radius, and system list per group
- „THE COL 285" and „WB-CC-MKI" in the header come from config – not from code
- Any squadron can fork the project, drop in their config, and have their own map
- **The user can type in any reference system**, no hardcoded anchor, full freedom of centre
- **The user can upload their own CSV**, self-assembled system lists are fully supported; no dependency on Spansh exports. The CSV must include at minimum the Spansh-compatible coordinate fields (Name, X, Y, Z), all other fields (economy, status, role, faction etc.) are optional enrichment.

---

## Strategic position: a command map, not another database

The tool should not become another general Elite Dangerous database, another route plotter, or another colonisation spreadsheet.

Those tools already exist, and the vast majority of them are excellent:

- **EDSM** is the canonical community source for system, body and coordinate data.
- **Spansh** is the strongest routing and large-scale data backbone.
- **Inara** is the dominant companion database for stations, factions, markets, squadrons and commanders.
- **Raven Colonial** is the current reference tool for colonisation project planning, construction progress and Fleet Carrier logistics.
- **EDDiscovery**, **EDGIS** and **ED3D-Galaxy-Map** show that 3D spatial views are possible and useful.

The opportunity for this new tool is different:

> **This tool is the visual command layer for a colonisation region.**

It should make a player-driven region readable as a place: where systems are, how they relate to each other, what is being built, where commanders are active, what role each system plays, and how the bubble grows over time.

The project should prioritise **visual synthesis** over duplicate data collection. If another tool already maintains a data domain well, Water Bubble should integrate or reference it rather than rebuild it.

### Product identity

> **Water Bubble is a tactical 3D command map for Elite Dangerous colonisation groups, starting with the Water Bubble in Col 285.**

It combines three levels of understanding:

1. **Bubble Map**: Where are our systems? Which ones are core, auxiliary or frontier? Which are colonised, planned, blocked or under construction?
2. **System Orrery**: What is inside a specific system? Which stars, planets, moons, stations and commander markers are known?
3. **Operations Overlay**: What is happening where? Which systems need cargo, attention, BGS work or construction support?

### Relationship to other tools

**Raven Colonial** Raven Colonial is strong at colonisation mechanics: projects, construction progress, Fleet Carrier cargo and build requirements. Water Bubble should not rebuild this logic. A future integration would treat Raven Colonial as a data source and render live colonisation progress in 3D, the one thing Raven Colonial itself does not do.

**Spansh and EDSM** Their role is data infrastructure. Water Bubble normalises their data into its own internal model and exposes it through the local backend. The frontend should not depend directly on multiple external APIs.

**ED3D-Galaxy-Map** It proved that Elite Dangerous system lists can be rendered as configurable 3D maps. Water Bubble is a modern TypeScript/Three.js/FastAPI reinterpretation, not a fork. Study its JSON-driven system schema, category/HUD filter model, and route rendering.

### Strategic design principles

**1. Integrate before rebuilding.** Before implementing a feature, ask: does Raven Colonial, Spansh, EDSM, Inara or BGS-Tally already maintain this better? If yes, prefer integration over rebuilding.

**2. Water Bubble first, platform second.** The first successful product must serve the Water Bubble well. A tool for everyone that is not excellent for its first community will not survive. Make the Water Bubble useful and beautiful first. Then generalise.

**3. Visual synthesis over exhaustive detail.** The map should not display every possible field from every external API. It should make the next decision easier: Where is the centre of activity? Which systems are quiet, active or blocked? Where are commanders present? Which systems need attention?

**4. Graceful uncertainty.** Elite Dangerous community data is incomplete and uneven. The UI should never pretend to know more than the data supports. Use language such as `known bodies`, `last updated`, `inferred relation`, `no station data available`, `commander location hidden or unknown`.

**5. Atmosphere must serve readability.** The console frame, HUD styling, glow, holographic shaders and animated transitions are part of the product identity — not decorative extras. But every effect should answer one of three questions: What is this? How important is it? What can I do with it?

---

## Vision: What the tool looks like in a year

### 🗺️ The Map
- Any system can be placed at the centre as an anchor, others can be manually chosen as part of a specific region / project / colony.
- aldus the map works for any region of Elite Dangerous, not just Col 285
- Smooth zoom, pan, and three-axis view (top, front, side)
- Connections show actual trade relationships, not just proximity

### 🌌 Visual layers / how the map evolves

The map is built in four visual layers, each adding depth to what the player sees and understands. They are designed to be implemented independently and in sequence.

**Layer 0: CMDR Location Layer (Project METIS, Phase 1)**

Before the map can show what systems exist, it should show who is where right now. METIS is the data pipeline that makes this possible. It is a separate module, opt-in per CMDR, local-first by design.

- CMDRs who choose to share their location appear as distinct markers on the bubble map — visually separate from system markers, not to be confused with them.
- A CMDR marker is only shown if the CMDR has actively opted in to sharing. No location is displayed without explicit participation.
- Source priority follows the METIS decision logic: fresh API/EDDN/EDMC report wins, then local journal, then best-guess cache, then unknown. The frontend only needs to consume what the METIS backend reports, it does not need to know the source.
- The freshness of a location is part of the data but is not displayed as a visible timestamp. A CMDR is either present or not. Staleness is handled at the backend level before the data reaches the map.
- METIS is Phase 1 of a larger roadmap (Phase 2: activity tracking, Phase 3: live squadron sync). The visual layer should be designed so these phases can be added without restructuring the map.

Data source: METIS backend report endpoint → squadron board endpoint → frontend.
Technical specification: `backend/app/metis_location_sharing.py` and `metis_location_db.py` *(pending approval and merge)*.

**Layer 1: The Bubble Map (exists, needs enhancement)**

The current map shows systems as sprite markers in 3D space. The next step is atmosphere and legibility:

- Colonised systems should visually glow, a selective bloom effect that makes inhabited systems immediately readable at any zoom level. Uncolonised systems remain dark and quiet.
- CMDR markers (from Layer 0) appear as a distinct marker type alongside system markers. They must be visually unambiguous: different shape, different colour register, different interaction behaviour.
- As the dataset grows, marker rendering should move to instanced geometry for performance. This is not urgent at current scale but should be designed for from the start.
- Visual references: Three.js selective bloom example (`webgpu_postprocessing_bloom_selective`), instanced billboards (`webgl_buffergeometry_instancing_billboards`).

**Layer 2: Zone visualisation (not yet built)**

Core, Auxiliary and Frontier are community concepts that should become visible in the map, not just data fields, but spatial volumes the eye can read.

- Each zone should appear as a soft, semi-transparent volume around its systems. Not a hard boundary, more like a cloud that fades at the edges.
- The shape follows the actual geometry of the systems, not an artificial sphere. A convex hull or volumetric approach is preferred over a radius circle.
- Visual references: Three.js volume cloud example (`webgl_volume_cloud`), `THREE.ConvexGeometry` from addons.

**Layer 3: Orrery View (not yet built)**

When a commander clicks on a system in the map, the galaxy view fades and the camera flies into a stylised, holographic representation of that system: its primary star or stars at the centre, planets and moons as glowing abstract spheres, stations as distinct technical glyphs, orbit rings as faint transparent lines.

The goal is legibility and atmosphere, not physical accuracy. Distances are scaled logarithmically. The look is SciFi HUD, not simulation.

Key design decisions:
- Galaxy view and system view are two separate `THREE.Group` objects within the same scene. No page navigation, no hard reload.
- System data is loaded live from EDSM on click and cached in-memory for repeat visits.
- If one or more CMDRs (who have opted in via METIS) are currently in this system, they appear as named markers in the orrery view, near the station they were last reported at if known, otherwise in a neutral orbit position.
- The camera transition into and out of the system view is animated the flight is part of the experience, maybe something like a standard "fly in effect"
- Labels, tooltips and detail panels are HTML overlays, not 3D text.
- Hover shows name and type. Click opens a detail panel with body or station data. Click on a CMDR marker shows CMDR name and last reported location source.
- "ESC" or a visible back button returns to the galaxy view.

Data source: EDSM API (`/api-system-v1/bodies`, `/api-system-v1/stations`) for bodies and stations. METIS backend for CMDR positions within the system.
Visual reference: `future-ui-jet.vercel.app` (attention: concept only, not open source.)
Technical specification: `docs/ORRERY_SPEC.md` *(see that file for full implementation detail and open questions)*.

### 🔴 The Console Frame
- No longer static but lights blink, indicators pulse
- The fish moves 🐟 😉
- Ambient sound design (optional): the hum of a space station, notification tones ("waring when a CMDR is under attack: see METIS concept)
- The UI feels like you're sitting at a terminal inside the game

### 🔍 Search & Filter
- Perfected system search across the entire loaded dataset
- Filter by economy, status, faction, allegiance, planet class, role
- Save and recall filter presets

### 📤 Data Export
The tool is not just a viewer but a data workflow.

- Any filtered view can be exported as CSV
- Typical workflow: type a reference system → set radius → apply filters → export
- Use cases:
  - „Show me all unclaimed water worlds within 30 ly" → export → share with squadron
  - „All systems in Expansion state" → export → use in Excel or another tool
  - Enrich an export with custom status/role fields → re-import into the tool
- Exported CSV is always Spansh-compatible (Name, X, Y, Z as minimum) so it can be re-uploaded directly

### 📊 Statistics & Analysis
- Trade route profitability calculator (live market data via EDDN)
- Faction influence tracking over time
- BGS state overlays (War, Boom, Expansion, Retreat...)
- Colonisation progress metrics: bodies, stations, population

### 🪐 System Detail View: The Narrative Layer

A click on a system opens its **story**:
- Who built it, and why
- Which CMDR or squadron claimed it
- What stands there now: stations under construction, completed, planned
- station could be "decorated" with uploadable in game pictures from the CMDRs
- What the economy produces and who benefits
- Where to go next: direct links to external tools:
  - [Ravencolonial](https://ravencolonial.com)
  - [Inara](https://inara.cz)
  - [Spansh](https://spansh.co.uk)
  - [EDDB](https://eddb.io)

### 👤 CMDR Features
- Login with CMDR name (squadron-defined access list)
- Multiple admin roles: admins can update data and manage the CMDR list
- Annotate systems: notes, planned roles, claimed status
- Personal view preferences saved per CMDR

### 🌐 Deployment
- No local server required, runs in the browser via a public URL
- Live data from Spansh and EDDN without manual refresh
- Shareable links: deep-link to a specific system or view

---

## Current status (as of 2026-05-31)

| Feature | Status |
|---|---|
| 3D star map (canvas) | ✅ Working |
| Real system data from Spansh CSV | ✅ Working |
| Economy & planet class visualisation | ✅ Working |
| Economy & status filter | ✅ Working |
| Radius filter with dropdown | ✅ Working |
| FastAPI backend | ✅ Working |
| EDDN live market listener | ⚠️ Built, not verified in production|
| Trade route calculator (sample data) | ⚠️ Works with sample data — not verified with live EDDN data |
| System status model (7 states) | ❌ Not built |
| System roles | ❌ Not built |
| METIS location agent (`metis_location_agent.py`) | ❌ Not built |
| METIS backend endpoints (location DB + sharing) | ❌ Not built |
| CMDR markers on bubble map (Layer 0) | ❌ Not built |
| CMDR markers in Orrery View (Layer 3) | ❌ Not built |
| Selective bloom (colonised systems glow) | ❌ Not built |
| Instanced marker rendering (performance) | ❌ Not built |
| Zone visualisation (Core / Auxiliary / Frontier) | ❌ Not built |
| Orrery View (system detail, planets in 3D) | ❌ Not built |
| Camera transition map → orrery | ❌ Not built |
| Group config system | ❌ Not built |
| CMDR login / access control | ❌ Not built |
| EDDN pad size fix (trade loops) | ❌ In progress |
| System detail / narrative view | ❌ Not built |
| BGS state overlays | ❌ Not built |
| Animated console frame | ❌ Not built |
| Public deployment | ❌ Not built |
| Statistical analysis tools | ❌ Not built |

---

## Implementation roadmap

### Phase A: Stabilise the Bubble Map
Make the current 3D region map feel like the core product. Reliable system markers, stable hover and click behaviour, readable economy/status/role colours, reference system and distance logic, Core/Auxiliary/Frontier fields in data, search and filters that commanders can actually use, clean fallback from backend data to bundled CSV, basic export workflow. Do this before adding deep external integrations.

### Phase B: Build the Orrery MVP
Prove that clicking a system can open a readable system-level view. In scope: `viewState` (galaxy / transition / system), separate `galaxyGroup` and `systemGroup`, click a system to open system detail mode, back button / ESC to return, camera transition, central star marker, schematic planets and stations, hover tooltip and click detail panel. Out of scope for MVP: exact orbital mechanics, live EDSM data, CMDR markers.

### Phase C: Wire live body and station data
Connect the backend detail endpoint to EDSM and Spansh. The frontend renders only a normalised internal model — it should not care whether the backend used EDSM, Spansh, cache or CSV. Degrade gracefully when data is incomplete or unavailable.

### Phase D: Add Water-Bubble-specific operational overlays
Once the Bubble Map and Orrery View are stable: colonisation status overlay, construction progress overlay, BGS state overlay, CMDR opt-in location markers (METIS), system notes and claims, project history and narrative timeline. This is where Water Bubble becomes more than a map.

### Phase E: Integrate external operational tools
Raven Colonial project and Fleet Carrier cargo data, BGS-Tally activity and state data, Inara links, Spansh links, EDSM links. First integration candidate: Raven Colonial project status → system colour / badge / detail panel overlay.

### Feature priority summary

**Must build first:** robust Bubble Map interaction, clean system data model, `galaxyGroup` / `systemGroup` separation, Orrery MVP, graceful error states.

**Should build next:** selective glow for colonised systems, zone visualisation (Core / Auxiliary / Frontier), system detail panel with external links, cached EDSM/Spansh bodies and stations, commander opt-in marker architecture.

**Later (only after product core works):** full trade route profitability engine, Raven Colonial live integration, BGS-Tally integration, commander login and role management, public deployment, custom group configuration UI, advanced shader polish, animated console frame and ambient sound.

**Avoid for now:** hard-coding current colonisation economy rules, rebuilding Raven Colonial's planning logic, trying to render the entire galaxy, exact orbital simulation, 3D text labels everywhere, making the first release dependent on multiple external live APIs.

---

## Technical foundation

- **Frontend:** TypeScript + Three.js (main app) / Vanilla JS (standalone HTML)
- **Backend:** Python / FastAPI + EDDN listener (FraggertheBoss bootstrap)
- **Data:** Spansh API + EDDN live stream + CSV export
- **Status model:** `unclaimed → planned → claimed → under_construction → colonized → developed → blocked`
- **Role model:** `Industrial / Refinery / High Tech / Agriculture / Tourism / Military / Service / Bridge / Strategic`

---

## How to contribute

The original developer built this with AI assistance and reached the limits of what they could do alone. The foundation is solid and well-commented.

If you want to contribute:
1. Fork the repository
2. Open an Issue describing what you want to build or fix
3. Submit a Pull Request
4. Or reach out on Discord to get added as a direct Collaborator

All skill levels welcome. The project needs developers, designers, Elite Dangerous players who know the BGS, and people who just want to give feedback.

---

## A note on scope

This tool was born from one colonisation project in one corner of the galaxy. That origin is a strength, not a limitation.

Water Bubble gives the project a real community, real systems, real coordination problems and real stories. The architecture should remain general enough for other groups, but the first duty is to make the Water Bubble legible, useful and alive.

The goal is not to compete with EDSM, Spansh, Inara or Raven Colonial. The goal is to make their data spatial, operational and visible.

Water Bubble is the proof of concept.
The platform is the long game.

Build the command map well, and other groups can bring their own bubble.

o7
