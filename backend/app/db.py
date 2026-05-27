from __future__ import annotations

from pathlib import Path
import sqlite3
from typing import Iterable, Mapping, Any

DB_PATH = Path(__file__).resolve().parents[1] / "waterbubble.sqlite3"
SCHEMA_PATH = Path(__file__).with_name("schema.sql")


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with connect() as conn:
        conn.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))


def upsert_systems(systems: Iterable[Mapping[str, Any]]) -> int:
    init_db()
    count = 0
    with connect() as conn:
        for s in systems:
            name = s.get("name") or s.get("n")
            if not name:
                continue
            conn.execute(
                """
                INSERT INTO systems
                  (name, x, y, z, economy, colonised, faction, allegiance,
                   faction_state, planet_class, body_count, station_count, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                ON CONFLICT(name) DO UPDATE SET
                  x=excluded.x,
                  y=excluded.y,
                  z=excluded.z,
                  economy=excluded.economy,
                  colonised=excluded.colonised,
                  faction=excluded.faction,
                  allegiance=excluded.allegiance,
                  faction_state=excluded.faction_state,
                  planet_class=excluded.planet_class,
                  body_count=excluded.body_count,
                  station_count=excluded.station_count,
                  updated_at=datetime('now')
                """,
                (
                    name,
                    float(s.get("x", 0)),
                    float(s.get("y", 0)),
                    float(s.get("z", 0)),
                    s.get("economy") or s.get("ec"),
                    1 if (s.get("colonised") or s.get("col")) else 0,
                    s.get("faction") or s.get("fac"),
                    s.get("allegiance") or s.get("al"),
                    s.get("factionState") or s.get("fs"),
                    s.get("planetClass") or s.get("pc"),
                    s.get("bodyCount") or s.get("bo"),
                    s.get("stationCount") or s.get("st"),
                ),
            )
            count += 1
    return count


def upsert_market_station(station: Mapping[str, Any], source: str = "manual") -> None:
    init_db()
    market_id = station.get("marketId") or station.get("market_id")
    if not market_id:
        return

    system_name = station.get("systemName") or station.get("system_name") or ""
    station_name = station.get("stationName") or station.get("station_name") or ""
    updated_at = station.get("updatedAt") or station.get("updated_at")

    with connect() as conn:
        conn.execute(
            """
            INSERT INTO stations
              (market_id, system_name, station_name, station_type, max_pad_size,
               distance_to_arrival_ls, updated_at, source)
            VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), ?)
            ON CONFLICT(market_id) DO UPDATE SET
              system_name=excluded.system_name,
              station_name=excluded.station_name,
              station_type=excluded.station_type,
              max_pad_size=excluded.max_pad_size,
              distance_to_arrival_ls=excluded.distance_to_arrival_ls,
              updated_at=excluded.updated_at,
              source=excluded.source
            """,
            (
                int(market_id),
                system_name,
                station_name,
                station.get("stationType") or station.get("station_type"),
                station.get("maxPadSize") or station.get("max_pad_size"),
                station.get("distanceToArrivalLs") or station.get("distance_to_arrival_ls"),
                updated_at,
                source,
            ),
        )

        for c in station.get("commodities", []):
            name = c.get("name") or c.get("commodityName") or c.get("commodity_name")
            if not name:
                continue
            conn.execute(
                """
                INSERT INTO commodities
                  (market_id, commodity_name, buy_price, sell_price, supply, demand, updated_at, source)
                VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), ?)
                ON CONFLICT(market_id, commodity_name) DO UPDATE SET
                  buy_price=excluded.buy_price,
                  sell_price=excluded.sell_price,
                  supply=excluded.supply,
                  demand=excluded.demand,
                  updated_at=excluded.updated_at,
                  source=excluded.source
                """,
                (
                    int(market_id),
                    name,
                    int(c.get("buyPrice") or c.get("buy_price") or 0),
                    int(c.get("sellPrice") or c.get("sell_price") or 0),
                    int(c.get("supply") or 0),
                    int(c.get("demand") or 0),
                    updated_at,
                    source,
                ),
            )
