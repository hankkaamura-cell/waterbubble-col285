from __future__ import annotations

# METIS Location Sharing Module - EDMC plugin proof-of-shape.
# Place this folder inside the EDMarketConnector plugins directory and set:
#   METIS_SERVER=http://127.0.0.1:8000
# Optional:
#   METIS_COMMANDER_NAME=Tsumikaze

import json
import os
from datetime import datetime, timezone
from urllib.request import Request, urlopen

PLUGIN_NAME = "METIS Location Sharing"
DEFAULT_SERVER = "http://127.0.0.1:8000"


def plugin_start3(plugin_dir: str) -> str:
    return PLUGIN_NAME


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _post(payload: dict) -> None:
    server = os.getenv("METIS_SERVER", DEFAULT_SERVER).rstrip("/")
    url = server + "/api/metis/location-sharing/reports/api"
    data = json.dumps(payload).encode("utf-8")
    request = Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urlopen(request, timeout=5) as response:
            response.read()
    except Exception:
        # EDMC plugins should not crash EDMC just because METIS is offline.
        pass


def journal_entry(cmdr, is_beta, system, station, entry, state):
    event = entry.get("event") if isinstance(entry, dict) else None
    if event not in {"Location", "FSDJump", "CarrierJump", "Docked", "Undocked", "LoadGame"}:
        return

    commander_name = os.getenv("METIS_COMMANDER_NAME") or cmdr
    system_name = entry.get("StarSystem") or system
    station_name = entry.get("StationName") or station
    ship_type = None

    if isinstance(state, dict):
        ship_type = state.get("ShipType") or state.get("ShipName")
    ship_type = ship_type or entry.get("Ship") or entry.get("ShipType")

    if not commander_name:
        return

    payload = {
        "commander_name": commander_name,
        "system_name": system_name,
        "station_name": station_name,
        "ship_type": ship_type,
        "source": "edmc",
        "source_detail": f"EDMC journal_entry callback: {event}",
        "observed_at": entry.get("timestamp") or _utc_now_iso(),
    }
    _post(payload)
