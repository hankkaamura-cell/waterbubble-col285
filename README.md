# waterbubble-col285

> Interactive star map and tool for the Water Bubble colonisation project in Col 285 - Elite Dangerous

The Water Bubble is a player-driven colonisation initiative in the Col 285 sector. This tool replaces static Discord screenshots with a living, interactive map showing where systems are, what's happening inside them, and where the bubble is growing.

---

## For commanders

### What is this?

A browser-based 3D star map of the Water Bubble. It shows all systems in the bubble, their economies, factions, colonisation status, and trade relationships. The goal is to make the bubble readable at a glance, for new members and veterans alike.

### What's planned?

- Colonised systems will glow. Uncolonised systems will be dark and quiet.
- Click on a system to fly inside it and see its stars, planets, stations and who's there.
- CMDR location sharing (opt-in) so you can see where your squadron mates are on the map.
- Trade route calculator with live market data.
- BGS state overlays — Expansion, War, Boom, Retreat at a glance.

The full vision is in [`VISION.md`](./VISION.md).

### How do I give feedback?

Open a [GitHub Issue](../../issues) no technical knowledge needed. Just describe what you'd like to see or what doesn't work. Or find us on Discord in the Water Bubble channel.

---

## For developers

### What's in this repo?

```
src/                  TypeScript frontend (Three.js star map)
backend/app/          Python FastAPI backend
  main.py             API routes
  db.py               SQLite database layer
  trade.py            Trade loop calculator
  eddn_listener.py    Live EDDN market data listener
  spansh_client.py    Spansh data import
  inara_client.py     Inara API (optional, CMDR profiles)
data/                 System and market seed data
docs/                 Technical specifications
  ORRERY_SPEC.md      System detail view (Orrery) — full spec
public/               Static assets (CSV, frame image)
```

### Where is the architecture documented?

- [`VISION.md`](./VISION.md) — project vision, visual layer roadmap, feature status table
- [`docs/ORRERY_SPEC.md`](./docs/ORRERY_SPEC.md) — full technical spec for the system detail view
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — data flow and backend design decisions
- [`docs/FIELDS.md`](./docs/FIELDS.md) — data model reference (systems, stations, commodities)
- [`docs/WIKI.md`](./docs/WIKI.md) — developer wiki with code token index and tuning guide

### How do I run it locally?

**Frontend**
```bash
npm install
npm run dev
# → http://localhost:5173
```

**Backend**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --port 8000 --reload
# → http://localhost:8000
```

**EDDN listener** (optional — live market data)
```bash
cd backend
python -m app.eddn_listener
```

The frontend loads system data from the backend on startup. If the backend is not running, it falls back to the bundled CSV in `public/`.

### How do I contribute?

1. Fork the repository
2. Open an Issue describing what you want to build or fix
3. Submit a Pull Request
4. Or reach out on Discord to be added as a direct collaborator

All skill levels welcome. The project needs developers, designers, Elite Dangerous players who know the BGS, and people who just want to give feedback.

### Tech stack

| Layer | Technology |
|---|---|
| Frontend | TypeScript, Three.js, Vite |
| Backend | Python, FastAPI, SQLite |
| Data sources | Spansh API, EDDN live stream, EDSM API |
| Deployment | Not yet public — local dev only |

---

## Status

The project is in active development. Core map functionality works. See the feature table in [`VISION.md`](./VISION.md) for the full current status.

---

MIT License 
o7

