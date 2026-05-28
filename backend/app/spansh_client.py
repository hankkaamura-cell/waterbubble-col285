from __future__ import annotations

import json
from pathlib import Path

from .db import upsert_systems, upsert_market_station


def import_systems_json(path: str | Path) -> int:
    """
    Imports Water Bubble systems from a JSON file.

    Supports the current prototype shape:
      [{ "n": "...", "x": ..., "y": ..., "z": ..., "ec": "...", ... }]

    If a Spansh export/dump has a different shape, normalize it here rather than
    changing the map.
    """
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if isinstance(data, dict):
        data = data.get("systems", [])
    return upsert_systems(data)


def import_markets_json(path: str | Path, source: str = "spansh_or_manual") -> int:
    """
    Imports market snapshots from a normalized JSON file:
      {
        "stations": [
          {
            "systemName": "...",
            "stationName": "...",
            "marketId": 123,
            "commodities": [...]
          }
        ]
      }
    """
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    stations = data.get("stations", data if isinstance(data, list) else [])
    count = 0
    for station in stations:
        station_payload = dict(station)

        # Sample market data is included for demos/local testing. Treat it as fresh
        # on startup so the default /api/trade-loops freshness window does not
        # make the backend look empty or broken a few days after packaging.
        if str(source).lower() == "sample":
            station_payload.pop("updatedAt", None)
            station_payload.pop("updated_at", None)

        upsert_market_station(station_payload, source=source)
        count += 1
    return count
