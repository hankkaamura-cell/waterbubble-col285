from __future__ import annotations

import json
import os
import zlib
from pathlib import Path
from typing import Any

import zmq

from .db import upsert_market_station


DEFAULT_RELAY = "tcp://eddn.edcd.io:9500"


def load_waterbubble_systems() -> set[str]:
    env_systems = os.getenv("WATERBUBBLE_SYSTEMS", "").strip()
    if env_systems:
        return {s.strip() for s in env_systems.split(",") if s.strip()}

    data_path = Path(__file__).resolve().parents[2] / "data" / "waterbubble_systems.json"
    if not data_path.exists():
        return set()

    data = json.loads(data_path.read_text(encoding="utf-8"))
    return {s.get("n") or s.get("name") for s in data if (s.get("n") or s.get("name"))}


def normalize_eddn_commodity_message(message: dict[str, Any]) -> dict[str, Any] | None:
    msg = message.get("message", {})
    market_id = msg.get("marketId")
    system_name = msg.get("systemName")
    station_name = msg.get("stationName")

    if not market_id or not system_name or not station_name:
        return None

    commodities = []
    for c in msg.get("commodities", []):
        name = c.get("name")
        if not name:
            continue
        commodities.append(
            {
                "name": name,
                "buyPrice": c.get("buyPrice", 0),
                "sellPrice": c.get("sellPrice", 0),
                "supply": c.get("stock", c.get("supply", 0)),
                "demand": c.get("demand", 0),
            }
        )

    if not commodities:
        return None

    return {
        "systemName": system_name,
        "stationName": station_name,
        "marketId": market_id,
        "stationType": msg.get("stationType"),
        "maxPadSize": msg.get("maxLandingPadSize"),
        "distanceToArrivalLs": msg.get("distanceToArrival"),
        "updatedAt": message.get("header", {}).get("gatewayTimestamp"),
        "commodities": commodities,
    }


def run_listener() -> None:
    relay = os.getenv("EDDN_RELAY", DEFAULT_RELAY)
    allowed_systems = load_waterbubble_systems()

    print(f"Connecting to EDDN relay: {relay}")
    if allowed_systems:
        print(f"Filtering to {len(allowed_systems)} Water Bubble systems")
    else:
        print("No Water Bubble system filter found. Listener will accept all systems. Be careful.")

    context = zmq.Context()
    socket = context.socket(zmq.SUB)
    socket.connect(relay)
    socket.setsockopt(zmq.SUBSCRIBE, b"")

    while True:
        raw = socket.recv()
        try:
            message = json.loads(zlib.decompress(raw))
        except Exception:
            continue

        schema_ref = message.get("$schemaRef", "")
        if "commodity" not in schema_ref.lower():
            continue

        station = normalize_eddn_commodity_message(message)
        if not station:
            continue

        if allowed_systems and station["systemName"] not in allowed_systems:
            continue

        upsert_market_station(station, source="eddn")
        print(f"Updated market: {station['systemName']} / {station['stationName']}")


if __name__ == "__main__":
    run_listener()
