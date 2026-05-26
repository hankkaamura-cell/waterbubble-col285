# 🌊 Water Bubble – Project Vision & Roadmap

> *"An interactive, living map of the Elite Dangerous galaxy – starting in Col 285."*

---

## What this started as

A personal side project: a browser-based star map for the Water Bubble colonisation initiative in Col 285. Built with TypeScript, Three.js, Python and a lot of AI assistance. The goal was simple – stop updating static images manually and replace them with something alive.

It worked. And then it grew.

---

## What this wants to become

A tool that any Elite Dangerous player can run and use to understand **how a region of the galaxy actually works** – not just where the systems are, but what's happening inside them.

- What trade relationships exist between systems?
- Where is the bubble expanding?
- Where is it most interesting to colonise next?
- What's being built, what's finished, what's struggling?

The Water Bubble is the starting point. But the architecture should work for **any cluster, any region, any squadron** in the galaxy.

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
- The fish moves
- Ambient sound design (optional): the hum of a space station, notification tones
- The UI feels like you're sitting at a terminal inside the game

### 🔍 Search & Filter
- Perfected system search across the entire loaded dataset
- Filter by economy, status, faction, allegiance, planet class, role
- Save and recall filter presets

### 📊 Statistics & Analysis
- Trade route profitability calculator (live market data via EDDN)
- Faction influence tracking over time
- BGS state overlays (War, Boom, Expansion, Retreat...)
- Colonisation progress metrics: bodies, stations, population

### 🪐 System Detail View
- Click any system → a detail panel opens
- Planet-by-planet breakdown with visual representation
- Stations shown: under construction and completed
- Direct links to external tools:
  - [Ravencolonial](https://ravencolonial.com)
  - [Inara](https://inara.cz)
  - [Spansh](https://spansh.co.uk)
  - [EDDB](https://eddb.io)

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
| System status model (7 states) | ✅ Working |
| System roles | ✅ Working |
| Standalone HTML version | ✅ Working |
| CMDR login / access control | ❌ Not built |
| EDDN live market data | ❌ Not built |
| Trade route calculator | ❌ Not built |
| BGS state overlays | ❌ Not built |
| System detail / planet view | ❌ Not built |
| Animated console frame | ❌ Not built |
| Public deployment | ❌ Not built |
| Statistical analysis tools | ❌ Not built |

---

## Technical foundation

- **Frontend:** TypeScript + Three.js (main app) / Vanilla JS (standalone HTML)
- **Backend:** Python / Flask (Spansh proxy)
- **Data:** Spansh API + CSV export
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

This tool was born from one colonisation project in one corner of the galaxy. But Elite Dangerous is a big place, and the problems it solves – *where are we, what's happening, where should we go next* – are universal to any organised group of players.

Build it right, and it works for everyone.

o7
