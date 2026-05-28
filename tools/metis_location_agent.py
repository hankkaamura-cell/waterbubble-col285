from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

DEFAULT_INTERVAL_SECONDS = 600
COMMANDER_EVENTS = {"Commander"}
LOCATION_EVENTS = {"Location", "FSDJump", "CarrierJump", "Docked"}
CLEAR_STATION_EVENTS = {"FSDJump", "CarrierJump", "Undocked", "SupercruiseEntry"}
SHIP_EVENTS = {"LoadGame", "ShipyardSwap", "ShipyardBuy", "Loadout"}


@dataclass
class LocationSnapshot:
    commander_name: str | None = None
    system_name: str | None = None
    station_name: str | None = None
    ship_type: str | None = None
    source: str = "unknown"
    source_detail: str | None = None
    observed_at: str | None = None
    notes: str | None = None

    def has_location(self) -> bool:
        return bool(self.system_name and self.system_name.strip())


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def parse_timestamp(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        normalized = value.strip().replace("Z", "+00:00")
        if "T" not in normalized and " " in normalized:
            normalized = normalized.replace(" ", "T") + "+00:00"
        parsed = datetime.fromisoformat(normalized)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc).replace(microsecond=0)
    except ValueError:
        return None


def normalize_timestamp(value: Any) -> str:
    parsed = parse_timestamp(value)
    return parsed.isoformat() if parsed else utc_now_iso()


def default_journal_dir() -> Path:
    if os.name == "nt":
        user_profile = os.environ.get("USERPROFILE")
        if user_profile:
            return Path(user_profile) / "Saved Games" / "Frontier Developments" / "Elite Dangerous"
    return Path.home() / "Saved Games" / "Frontier Developments" / "Elite Dangerous"


def cache_path() -> Path:
    base = Path(os.getenv("METIS_CACHE_DIR", Path.home() / ".metis"))
    base.mkdir(parents=True, exist_ok=True)
    return base / "location_cache.json"


def read_json_line(line: str) -> dict[str, Any] | None:
    line = line.strip()
    if not line:
        return None
    try:
        data = json.loads(line)
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def latest_journal_files(journal_dir: Path, max_files: int = 8) -> list[Path]:
    try:
        files = sorted(
            journal_dir.glob("Journal.*.log"),
            key=lambda path: path.stat().st_mtime,
            reverse=True,
        )
    except OSError:
        return []
    selected = files[:max(1, max_files)]
    selected.sort(key=lambda path: (path.name, path.stat().st_mtime))
    return selected


def clean_ship_name(value: Any) -> str | None:
    if not isinstance(value, str) or not value.strip():
        return None
    return value.replace("_name", "").replace("_", " ").strip()


def apply_journal_event(snapshot: LocationSnapshot, entry: dict[str, Any]) -> None:
    event = entry.get("event")
    if not isinstance(event, str):
        return
    timestamp = normalize_timestamp(entry.get("timestamp"))

    if event in COMMANDER_EVENTS:
        commander = entry.get("Commander") or entry.get("Name")
        if isinstance(commander, str) and commander.strip():
            snapshot.commander_name = commander.strip()

    if event in SHIP_EVENTS:
        ship = clean_ship_name(entry.get("Ship") or entry.get("ShipType") or entry.get("Ship_Localised"))
        if ship:
            snapshot.ship_type = ship

    if event in LOCATION_EVENTS:
        system = entry.get("StarSystem") or entry.get("SystemName")
        if isinstance(system, str) and system.strip():
            snapshot.system_name = system.strip()
            snapshot.observed_at = timestamp
            snapshot.source_detail = f"Elite journal event: {event}"

        station = entry.get("StationName")
        if event in {"Location", "Docked"} and isinstance(station, str) and station.strip():
            snapshot.station_name = station.strip()

        if event in CLEAR_STATION_EVENTS:
            snapshot.station_name = None

    elif event in CLEAR_STATION_EVENTS and snapshot.system_name:
        snapshot.station_name = None
        snapshot.observed_at = timestamp
        snapshot.source_detail = f"Elite journal event: {event}"


def refresh_with_status_json(snapshot: LocationSnapshot, journal_dir: Path) -> None:
    # Status.json is useful as a freshness pulse, but it is not treated as the main source for system name.
    if not snapshot.system_name:
        return
    status_path = journal_dir / "Status.json"
    if not status_path.exists():
        return
    try:
        data = json.loads(status_path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError):
        return
    raw_timestamp = data.get("timestamp") if isinstance(data, dict) else None
    status_time = parse_timestamp(raw_timestamp)
    observed_time = parse_timestamp(snapshot.observed_at)
    if status_time and (observed_time is None or status_time > observed_time):
        snapshot.observed_at = status_time.isoformat()
        snapshot.source_detail = "Elite Status.json freshness refresh"


def scan_journal(journal_dir: Path, commander_override: str | None, max_files: int) -> LocationSnapshot:
    snapshot = LocationSnapshot(source="journal", source_detail="Elite local journal scan")
    if commander_override:
        snapshot.commander_name = commander_override

    if not journal_dir.exists():
        snapshot.notes = f"Journal directory does not exist: {journal_dir}"
        return snapshot

    files = latest_journal_files(journal_dir, max_files=max_files)
    if not files:
        snapshot.notes = f"No Journal.*.log files found in: {journal_dir}"
        return snapshot

    for path in files:
        try:
            with path.open("r", encoding="utf-8-sig", errors="replace") as handle:
                for line in handle:
                    entry = read_json_line(line)
                    if entry:
                        apply_journal_event(snapshot, entry)
        except OSError:
            continue

    refresh_with_status_json(snapshot, journal_dir)
    return snapshot


def read_api_location(api_url: str, commander_name: str | None, api_source: str, timeout: int = 10) -> LocationSnapshot:
    """Generic API/bridge probe for INARA/EDDN/EDMC/SRV Survey-style location feeds.

    Expected JSON response:
      {
        "commander_name": "Tsumikaze",
        "system_name": "Col 285 Sector FI-J c9-12",
        "station_name": "Optional Station",
        "ship_type": "Type-9 Heavy",
        "observed_at": "2026-05-28T00:00:00Z"
      }
    """
    if not api_url:
        return LocationSnapshot(source=api_source, notes="No API bridge URL configured.")

    query = urlencode({"commander_name": commander_name or ""})
    separator = "&" if "?" in api_url else "?"
    url = f"{api_url}{separator}{query}"
    request = Request(url, headers={"Accept": "application/json", "User-Agent": "METIS-Location-Agent/1.0"})

    try:
        with urlopen(request, timeout=timeout) as response:
            data = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        return LocationSnapshot(source=api_source, notes=f"API bridge unavailable: {exc}")

    if not isinstance(data, dict):
        return LocationSnapshot(source=api_source, notes="API bridge returned non-object JSON.")

    return LocationSnapshot(
        commander_name=data.get("commander_name") or commander_name,
        system_name=data.get("system_name"),
        station_name=data.get("station_name"),
        ship_type=data.get("ship_type"),
        source=api_source,
        source_detail=data.get("source_detail") or f"Configured {api_source} bridge",
        observed_at=normalize_timestamp(data.get("observed_at")),
        notes=data.get("notes"),
    )


def read_cached_best_guess(commander_name: str | None) -> LocationSnapshot:
    path = cache_path()
    if not path.exists():
        return LocationSnapshot(commander_name=commander_name, source="unknown", notes="No local cache available.")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return LocationSnapshot(commander_name=commander_name, source="unknown", notes="Local cache could not be read.")

    if commander_name and data.get("commander_name") not in {commander_name, None, ""}:
        return LocationSnapshot(commander_name=commander_name, source="unknown", notes="Local cache belongs to a different commander.")

    return LocationSnapshot(
        commander_name=data.get("commander_name") or commander_name,
        system_name=data.get("system_name"),
        station_name=data.get("station_name"),
        ship_type=data.get("ship_type"),
        source="best_guess",
        source_detail=f"Local best guess cache: {path}",
        observed_at=data.get("observed_at"),
        notes="No API bridge or journal location available. Using local cached best guess.",
    )


def write_cache(snapshot: LocationSnapshot) -> None:
    if not snapshot.has_location():
        return
    cache_path().write_text(json.dumps(asdict(snapshot), indent=2), encoding="utf-8")


def choose_location(args: argparse.Namespace) -> LocationSnapshot:
    # 1) API/bridge location first, if configured.
    if args.api_location_url:
        api_snapshot = read_api_location(args.api_location_url, args.commander, args.api_source)
        if api_snapshot.has_location():
            return api_snapshot

    # 2) Local commander journal fallback.
    journal_dir = Path(args.journal_dir).expanduser() if args.journal_dir else default_journal_dir()
    journal_snapshot = scan_journal(journal_dir, args.commander, args.max_files)
    if journal_snapshot.has_location():
        return journal_snapshot

    # 3) Cached best guess / last known.
    cached = read_cached_best_guess(args.commander)
    if cached.has_location():
        return cached

    # 4) Nothing useful.
    return LocationSnapshot(
        commander_name=args.commander,
        source="unknown",
        observed_at=utc_now_iso(),
        notes="No API bridge, journal location, or cached best guess available.",
    )


def post_location(server: str, snapshot: LocationSnapshot, timeout: int = 10) -> dict[str, Any]:
    endpoint = "/api/metis/location-sharing/reports/api" if snapshot.source in {"api_inara", "api_eddn", "edmc", "srv_survey"} else "/api/metis/location-sharing/reports/journal"
    if snapshot.source in {"best_guess", "unknown"}:
        endpoint = "/api/metis/location-sharing/reports"

    url = server.rstrip("/") + endpoint
    payload = asdict(snapshot)
    data = json.dumps(payload).encode("utf-8")
    request = Request(
        url,
        data=data,
        headers={"Content-Type": "application/json", "User-Agent": "METIS-Location-Agent/1.0"},
        method="POST",
    )
    with urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def run_once(args: argparse.Namespace) -> None:
    snapshot = choose_location(args)
    if not snapshot.commander_name:
        raise RuntimeError("Commander name could not be inferred. Set --commander or METIS_COMMANDER_NAME.")

    if snapshot.has_location():
        write_cache(snapshot)

    if args.print_only:
        print(json.dumps(asdict(snapshot), indent=2))
        return

    result = post_location(args.server, snapshot)
    print(json.dumps(result, indent=2))


def main() -> int:
    parser = argparse.ArgumentParser(description="METIS Phase 1 local location sharing agent")
    parser.add_argument("--server", default=os.getenv("METIS_SERVER", "http://127.0.0.1:8000"))
    parser.add_argument("--commander", default=os.getenv("METIS_COMMANDER_NAME"))
    parser.add_argument("--journal-dir", default=os.getenv("METIS_JOURNAL_DIR"))
    parser.add_argument("--api-location-url", default=os.getenv("METIS_API_LOCATION_URL"))
    parser.add_argument(
        "--api-source",
        default=os.getenv("METIS_API_SOURCE", "api_inara"),
        choices=["api_inara", "api_eddn", "edmc", "srv_survey"],
    )
    parser.add_argument("--interval", type=int, default=int(os.getenv("METIS_INTERVAL_SECONDS", DEFAULT_INTERVAL_SECONDS)))
    parser.add_argument("--max-files", type=int, default=8)
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--print-only", action="store_true")
    args = parser.parse_args()

    if args.once:
        run_once(args)
        return 0

    while True:
        try:
            run_once(args)
        except Exception as exc:
            print(f"[METIS Location Agent] {exc}", file=sys.stderr)
        time.sleep(max(60, args.interval))


if __name__ == "__main__":
    raise SystemExit(main())
