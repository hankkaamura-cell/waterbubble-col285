# 🌊 Water Bubble – Project Vision & Roadmap

> *"An interactive, living map of the Elite Dangerous galaxy – starting in Col 285."*

---

## What this started as

A personal side project: a browser-based star map for the Water Bubble colonisation initiative in Col 285. Built with TypeScript, Three.js, and Python. The goal was simple – stop updating static images manually and replace them with something alive.

---

## What this wants to become

A tool that any Elite Dangerous player can run and use to understand **how a region of the galaxy actually works** – not just where the systems are, but what's happening inside them.

- What trade relationships exist between systems?
- Where is the bubble expanding?
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
- Number of settlements
- Notable price phenomena

This is exactly the data our tool should absorb and visualise automatically.

**Dedicated webpage:**
There is a community aspiration for a dedicated Water Bubble webpage.

---

## The bigger picture: a platform, not just a tool

Water Bubble is the prototype. 

Every organised group of Elite Dangerous players faces the same problems: no shared map, no project history, no way to see what they've collectively built. BGS squadrons, colonisation fleets, exploration groups – they all coordinate in Discord and spreadsheets, with no visual layer that makes their work visible.

This tool can change that – for any group, not just Water Bubble.

The key insight: **the code knows nothing about Water Bubble specifically**. It knows about systems, factions, economies, trade, and status. Water Bubble is just a configuration. Any group can bring their own.

This shapes every UX and UI decision from here on.

### 🎨 Group configuration (not hardcoded)
- Group name, logo, and colour palette defined in `config.json`
- Reference system, default radius, and system list per group
- „THE COL 285" and „WB-CC-MKI" in the header come from config – not from code
- Any squadron can fork the project, drop in their config, and have their own map
- **The user can type in any reference system** – no hardcoded anchor, full freedom of centre
- **The user can upload their own CSV** – self-assembled system lists are fully supported; no dependency on Spansh exports. The CSV must include at minimum the Spansh-compatible coordinate fields (Name, X, Y, Z) – all other fields (economy, status, role, faction etc.) are optional enrichment. The CSV must include at minimum the Spansh-compatible coordinate fields (, , , ) – all other fields (economy, status, role, faction etc.) are optional enrichment

---

## Vision: What the tool looks like in a year

### 🗺️ The Map
- Any system can be placed at the centre – not just the Water Bubble anchor
- The map works for any region of Elite Dangerous, not just Col 285
- Smooth zoom, pan, and three-axis view (top, front, side)
- Connections show actual trade relationships, not just proximity
- Expansion direction is visually readable at a glance

### 🔴 The Console Frame
- No longer static – lights blink, indicators pulse
- The fish moves 🐟
- Ambient sound design (optional): the hum of a space station, notification tones
- The UI feels like you're sitting at a terminal inside the game

### 🔍 Search & Filter
- Perfected system search across the entire loaded dataset
- Filter by economy, status, faction, allegiance, planet class, role
- Save and recall filter presets

### 📤 Data Export
The tool is not just a viewer – it is a data workflow.

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

### 🪐 System Detail View – The Narrative Layer
The map is not the destination. It is the entrance.

A click on a system opens its **story**:
- Who built it, and why
- Which CMDR or squadron claimed it
- What stands there now – stations under construction, completed, planned
- What the economy produces and who benefits
- What happened here over time – a timeline of BGS states, ownership changes, expansion events
- Where to go next – direct links to external tools:
  - [Ravencolonial](https://ravencolonial.com)
  - [Inara](https://inara.cz)
  - [Spansh](https://spansh.co.uk)
  - [EDDB](https://eddb.io)

The system detail view is where data becomes history, and history becomes motivation to keep building.

### 👤 CMDR Features
- Login with CMDR name (squadron-defined access list)
- Multiple admin roles – admins can update data and manage the CMDR list
- Annotate systems: notes, planned roles, claimed status
- Personal view preferences saved per CMDR

### 🌐 Deployment
- No local server required – runs in the browser via a public URL
- Live data from Spansh and EDDN without manual refresh
- Shareable links: deep-link to a specific system or view

---

## Current status (as of project handover)

| Feature | Status |
|---|---|
| 2D/3D star map (canvas) | ✅ Working |
| Real system data from Spansh CSV | ✅ Working |
| Economy & planet class visualisation | ✅ Working |
| Three axis views (top / front / side) | ✅ Working |
| Economy & status filter | ✅ Working |
| Radius filter with dropdown | ✅ Working |
| Live Spansh connection (local proxy) | ✅ Working |
| FastAPI backend (Tsumikaze) | ✅ Working |
| EDDN live market listener | ✅ Working |
| Trade route calculator (sample data) | ✅ Working |
| System status model (7 states) | ✅ Working |
| System roles | ✅ Working |
| Standalone HTML version | ✅ Working |
| Group config system | ❌ Not built |
| CMDR login / access control | ❌ Not built |
| EDDN pad size fix (trade loops) | ❌ In progress |
| System detail / narrative view | ❌ Not built |
| BGS state overlays | ❌ Not built |
| Animated console frame | ❌ Not built |
| Public deployment | ❌ Not built |
| Statistical analysis tools | ❌ Not built |

---

## Technical foundation

- **Frontend:** TypeScript + Three.js (main app) / Vanilla JS (standalone HTML)
- **Backend:** Python / FastAPI + EDDN listener (Tsumikaze bootstrap)
- **Data:** Spansh API + EDDN live stream + CSV export
- **Status model:** `unclaimed → planned → claimed → under_construction → colonized → developed → blocked`
- **Role model:** `Industrial / Refinery / High Tech / Agriculture / Tourism / Military / Service / Bridge / Strategic`

---

## How to contribute

The project foundation is solid and well-commented, but it needs additional contributors for polish, deployment, long-term maintenance, and feature expansion.

If you want to contribute:
1. Fork the repository
2. Open an Issue describing what you want to build or fix
3. Submit a Pull Request
4. Or reach out on Discord to get added as a direct Collaborator

All skill levels welcome. The project needs developers, designers, Elite Dangerous players who know the BGS, and people who just want to give feedback.

---

## A note on scope

This tool was born from one colonisation project in one corner of the galaxy. But Elite Dangerous is a big place, and the problems it solves – *where are we, what's happening, where should we go next* – are universal to any organised group of players.

Water Bubble is the proof of concept. The platform is for everyone.

Build it right, and it works for everyone.

o7
