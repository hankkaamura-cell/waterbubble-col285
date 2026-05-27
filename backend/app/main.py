from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from .db import connect, init_db, upsert_systems
from .spansh_client import import_systems_json, import_markets_json
from .trade import find_trade_loops
from .inara_client import InaraClient


app = FastAPI(title="Water Bubble API Bootstrap", version="0.1.0")

# Development only. Lock this down before public deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = Path(__file__).resolve().parents[2] / "data"


@app.on_event("startup")
def startup() -> None:
    init_db()
    systems_file = DATA_DIR / "waterbubble_systems.json"
    if systems_file.exists():
        import_systems_json(systems_file)

    sample_markets = DATA_DIR / "sample_markets.json"
    if sample_markets.exists():
        import_markets_json(sample_markets, source="sample")


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "service": "waterbubble-api-bootstrap"}


@app.get("/api/systems")
def get_systems() -> list[dict]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT
              name AS n,
              x, y, z,
              economy AS ec,
              colonised AS col,
              faction AS fac,
              allegiance AS al,
              faction_state AS fs,
              planet_class AS pc,
              body_count AS bo,
              station_count AS st,
              updated_at
            FROM systems
            ORDER BY name
            """
        ).fetchall()

    result = []
    for row in rows:
        item = dict(row)
        item["col"] = bool(item["col"])
        result.append(item)
    return result


@app.get("/api/stations")
def get_stations(system: str | None = None) -> list[dict]:
    query = """
        SELECT market_id, system_name, station_name, station_type, max_pad_size,
               distance_to_arrival_ls, updated_at, source
        FROM stations
    """
    params = []
    if system:
        query += " WHERE system_name = ?"
        params.append(system)
    query += " ORDER BY system_name, station_name"

    with connect() as conn:
        return [dict(r) for r in conn.execute(query, params).fetchall()]


@app.get("/api/stations/{market_id}/commodities")
def get_station_commodities(market_id: int) -> list[dict]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT commodity_name, buy_price, sell_price, supply, demand, updated_at, source
            FROM commodities
            WHERE market_id = ?
            ORDER BY commodity_name
            """,
            (market_id,),
        ).fetchall()
    return [dict(r) for r in rows]


@app.get("/api/trade-loops")
def trade_loops(
    cargo_capacity: int = Query(784, ge=1),
    required_pad: str = Query("L", pattern="^[SMLsml]$"),
    max_age_hours: int = Query(48, ge=1),
    commodity: str | None = None,
    colonization_only: bool = True,
    min_profit_per_ton: int = Query(1, ge=0),
    include_carriers: bool = False,
    limit: int = Query(50, ge=1, le=500),
) -> list[dict]:
    return find_trade_loops(
        cargo_capacity=cargo_capacity,
        required_pad=required_pad.upper(),
        max_age_hours=max_age_hours,
        commodity=commodity,
        colonization_only=colonization_only,
        min_profit_per_ton=min_profit_per_ton,
        include_carriers=include_carriers,
        limit=limit,
    )


@app.post("/api/import/systems")
def import_systems(payload: list[dict]) -> dict:
    count = upsert_systems(payload)
    return {"imported": count}


@app.post("/api/import/markets")
def import_markets(payload: dict) -> dict:
    stations = payload.get("stations", [])
    count = 0
    from .db import upsert_market_station
    for station in stations:
        upsert_market_station(station, source=payload.get("source", "api"))
        count += 1
    return {"imported": count}


@app.get("/api/inara/commander/{commander_name}")
async def inara_commander(commander_name: str) -> dict:
    """
    Optional proof-of-life endpoint for Inara.
    Requires INARA_API_KEY in .env.
    """
    client = InaraClient()
    return await client.get_commander_profile(commander_name)
