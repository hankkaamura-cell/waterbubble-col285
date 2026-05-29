from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Literal

from fastapi import APIRouter, FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

from .metis_location_db import connect

router = APIRouter(
    prefix="/api/metis/location-sharing",
    tags=["METIS Phase 1 - Location Sharing"],
)

# METIS Phase 1 / Layer 1: Location
#
# Rule chain:
#   1. Prefer fresh API-fed location reports: INARA bridge, EDDN bridge, EDMC, SRV Survey bridge.
#   2. If no fresh API-fed report exists, use the CMDR's local Elite journal report.
#   3. If neither exists, use the most recent known location as best_guess.
#   4. If no parameter is met, set the CMDR location as unknown.
#
# The central squadron server cannot read every CMDR's local game logs directly.
# Each CMDR runs tools/metis_location_agent.py locally, or an EDMC/SRVSurvey bridge/plugin
# posts location reports into this module.

UPDATE_CADENCE_SECONDS = 600      # 10 minutes
LIVE_WINDOW_MINUTES = 12          # 10-minute cadence + small drift buffer
API_FRESH_MINUTES = 15            # API/bridge reports get priority while fresh
RECENT_STILL_MINUTES = 6 * 60     # Still useful on the squadron board

Confidence = Literal["live", "recent", "last_known", "unknown"]


class LocationSource(str, Enum):
    API_INARA = "api_inara"
    API_EDDN = "api_eddn"
    EDMC = "edmc"
    SRV_SURVEY = "srv_survey"
    JOURNAL = "journal"
    MANUAL = "manual"
    BEST_GUESS = "best_guess"
    UNKNOWN = "unknown"


API_PRIORITY_SOURCES = {
    LocationSource.API_INARA.value,
    LocationSource.API_EDDN.value,
    LocationSource.EDMC.value,
    LocationSource.SRV_SURVEY.value,
}


class CommanderIn(BaseModel):
    commander_name: str = Field(..., min_length=2, max_length=64)
    display_name: str | None = Field(default=None, max_length=80)
    squadron_role: str | None = Field(default=None, max_length=80)
    sharing_enabled: bool = True
    notes: str | None = Field(default=None, max_length=500)


class LocationReportIn(BaseModel):
    commander_name: str = Field(..., min_length=2, max_length=64)
    system_name: str | None = Field(default=None, max_length=120)
    station_name: str | None = Field(default=None, max_length=120)
    ship_type: str | None = Field(default=None, max_length=80)
    source: LocationSource = LocationSource.MANUAL
    source_detail: str | None = Field(default=None, max_length=180)
    observed_at: str | None = Field(default=None, description="ISO-8601 timestamp from the source, UTC preferred.")
    notes: str | None = Field(default=None, max_length=500)


class LocationOut(BaseModel):
    commander_name: str
    display_name: str | None = None
    squadron_role: str | None = None
    sharing_enabled: bool = True
    system_name: str | None = None
    station_name: str | None = None
    ship_type: str | None = None
    source: str
    source_detail: str | None = None
    confidence: Confidence
    observed_at: str | None = None
    received_at: str | None = None
    reconciled_at: str | None = None
    age_minutes: int | None = None
    notes: str | None = None


class SquadronBoardOut(BaseModel):
    module: str
    phase: str
    generated_at: str
    update_cadence_seconds: int
    source_priority: list[str]
    counts: dict[str, int]
    commanders: list[LocationOut]


class RefreshOut(BaseModel):
    ok: bool
    refreshed: int
    locations: list[LocationOut]


class ModuleHealthOut(BaseModel):
    ok: bool
    module: str
    phase: str
    update_cadence_seconds: int
    live_window_minutes: int
    api_fresh_minutes: int
    recent_still_minutes: int


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def utc_now_iso() -> str:
    return utc_now().isoformat()


def parse_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        normalized = value.strip().replace("Z", "+00:00")
        if "T" not in normalized and " " in normalized:
            normalized = normalized.replace(" ", "T") + "+00:00"
        parsed = datetime.fromisoformat(normalized)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc).replace(microsecond=0)
    except (TypeError, ValueError):
        return None


def normalize_timestamp(value: str | None) -> str:
    if not value:
        return utc_now_iso()
    parsed = parse_timestamp(value)
    if parsed is None:
        raise HTTPException(status_code=400, detail=f"Invalid observed_at timestamp: {value}")
    return parsed.isoformat()


def age_minutes(value: str | None) -> int | None:
    parsed = parse_timestamp(value)
    if parsed is None:
        return None
    return max(0, int((utc_now() - parsed).total_seconds() // 60))


def confidence_for(system_name: str | None, observed_at: str | None) -> Confidence:
    if not system_name:
        return "unknown"
    age = age_minutes(observed_at)
    if age is None:
        return "unknown"
    if age <= LIVE_WINDOW_MINUTES:
        return "live"
    if age <= RECENT_STILL_MINUTES:
        return "recent"
    return "last_known"


def init_metis_location_db() -> None:
    """Create METIS-only tables.

    This does not change any existing Water Bubble tables. The host project decides where
    METIS_DB_PATH points and when this router is mounted.
    """
    with connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS metis_location_commanders (
              commander_name TEXT PRIMARY KEY,
              display_name TEXT,
              squadron_role TEXT,
              sharing_enabled INTEGER NOT NULL DEFAULT 1,
              notes TEXT,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS metis_location_reports (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              commander_name TEXT NOT NULL,
              system_name TEXT,
              station_name TEXT,
              ship_type TEXT,
              source TEXT NOT NULL DEFAULT 'unknown',
              source_detail TEXT,
              observed_at TEXT NOT NULL,
              received_at TEXT NOT NULL DEFAULT (datetime('now')),
              notes TEXT,
              FOREIGN KEY (commander_name) REFERENCES metis_location_commanders(commander_name)
            );

            CREATE TABLE IF NOT EXISTS metis_current_locations (
              commander_name TEXT PRIMARY KEY,
              system_name TEXT,
              station_name TEXT,
              ship_type TEXT,
              source TEXT NOT NULL DEFAULT 'unknown',
              source_detail TEXT,
              confidence TEXT NOT NULL DEFAULT 'unknown',
              observed_at TEXT,
              received_at TEXT,
              reconciled_at TEXT NOT NULL DEFAULT (datetime('now')),
              notes TEXT,
              FOREIGN KEY (commander_name) REFERENCES metis_location_commanders(commander_name)
            );

            CREATE INDEX IF NOT EXISTS idx_metis_location_reports_commander_source_time
              ON metis_location_reports(commander_name, source, observed_at DESC, id DESC);

            CREATE INDEX IF NOT EXISTS idx_metis_location_reports_system_time
              ON metis_location_reports(system_name, observed_at DESC, id DESC);
            """
        )


def ensure_commander(conn: Any, commander_name: str) -> None:
    conn.execute(
        """
        INSERT INTO metis_location_commanders (commander_name, display_name, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(commander_name) DO UPDATE SET updated_at = datetime('now')
        """,
        (commander_name, commander_name),
    )


def row_to_location(row: Any) -> LocationOut:
    item = dict(row)
    return LocationOut(
        commander_name=item["commander_name"],
        display_name=item.get("display_name"),
        squadron_role=item.get("squadron_role"),
        sharing_enabled=bool(item.get("sharing_enabled", 1)),
        system_name=item.get("system_name"),
        station_name=item.get("station_name"),
        ship_type=item.get("ship_type"),
        source=item.get("source") or LocationSource.UNKNOWN.value,
        source_detail=item.get("source_detail"),
        confidence=(item.get("confidence") or "unknown"),
        observed_at=item.get("observed_at"),
        received_at=item.get("received_at"),
        reconciled_at=item.get("reconciled_at"),
        age_minutes=age_minutes(item.get("observed_at")),
        notes=item.get("notes"),
    )


def select_best_report(conn: Any, commander_name: str) -> dict[str, Any] | None:
    rows = [
        dict(r)
        for r in conn.execute(
            """
            SELECT id, commander_name, system_name, station_name, ship_type, source,
                   source_detail, observed_at, received_at, notes
            FROM metis_location_reports
            WHERE commander_name = ?
              AND system_name IS NOT NULL
              AND TRIM(system_name) != ''
            ORDER BY observed_at DESC, id DESC
            LIMIT 100
            """,
            (commander_name,),
        ).fetchall()
    ]

    if not rows:
        return None

    # 1) Fresh API/bridge source gets first priority.
    for row in rows:
        age = age_minutes(row.get("observed_at"))
        if row.get("source") in API_PRIORITY_SOURCES and age is not None and age <= API_FRESH_MINUTES:
            return row

    # 2) If API-fed data is not fresh/available, use the latest local Elite journal report.
    journal_rows = [r for r in rows if r.get("source") == LocationSource.JOURNAL.value]
    if journal_rows:
        return journal_rows[0]

    # 3) No API or journal. Use most recent known location as a best guess.
    best_guess = rows[0].copy()
    original_source = best_guess.get("source") or "unknown"
    best_guess["source"] = LocationSource.BEST_GUESS.value
    detail = best_guess.get("source_detail") or original_source
    best_guess["source_detail"] = f"Best guess from last known {detail} report"
    if not best_guess.get("notes"):
        best_guess["notes"] = "No fresh API-fed or journal source available. Using last known position as best guess."
    return best_guess


def reconcile_commander(commander_name: str) -> LocationOut:
    init_metis_location_db()
    reconciled_at = utc_now_iso()
    with connect() as conn:
        ensure_commander(conn, commander_name)
        selected = select_best_report(conn, commander_name)

        if selected is None:
            conn.execute(
                """
                INSERT INTO metis_current_locations
                  (commander_name, system_name, station_name, ship_type, source, source_detail,
                   confidence, observed_at, received_at, reconciled_at, notes)
                VALUES (?, NULL, NULL, NULL, 'unknown', NULL, 'unknown', NULL, NULL, ?,
                        'No API-fed, journal, or best-guess location available.')
                ON CONFLICT(commander_name) DO UPDATE SET
                  system_name=NULL,
                  station_name=NULL,
                  ship_type=NULL,
                  source='unknown',
                  source_detail=NULL,
                  confidence='unknown',
                  observed_at=NULL,
                  received_at=NULL,
                  reconciled_at=excluded.reconciled_at,
                  notes=excluded.notes
                """,
                (commander_name, reconciled_at),
            )
        else:
            confidence = confidence_for(selected.get("system_name"), selected.get("observed_at"))
            conn.execute(
                """
                INSERT INTO metis_current_locations
                  (commander_name, system_name, station_name, ship_type, source, source_detail,
                   confidence, observed_at, received_at, reconciled_at, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(commander_name) DO UPDATE SET
                  system_name=excluded.system_name,
                  station_name=excluded.station_name,
                  ship_type=excluded.ship_type,
                  source=excluded.source,
                  source_detail=excluded.source_detail,
                  confidence=excluded.confidence,
                  observed_at=excluded.observed_at,
                  received_at=excluded.received_at,
                  reconciled_at=excluded.reconciled_at,
                  notes=excluded.notes
                """,
                (
                    commander_name,
                    selected.get("system_name"),
                    selected.get("station_name"),
                    selected.get("ship_type"),
                    selected.get("source") or LocationSource.UNKNOWN.value,
                    selected.get("source_detail"),
                    confidence,
                    selected.get("observed_at"),
                    selected.get("received_at"),
                    reconciled_at,
                    selected.get("notes"),
                ),
            )

        row = conn.execute(
            """
            SELECT c.commander_name, c.display_name, c.squadron_role, c.sharing_enabled,
                   l.system_name, l.station_name, l.ship_type, l.source, l.source_detail,
                   l.confidence, l.observed_at, l.received_at, l.reconciled_at, l.notes
            FROM metis_location_commanders c
            LEFT JOIN metis_current_locations l ON l.commander_name = c.commander_name
            WHERE c.commander_name = ?
            """,
            (commander_name,),
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail=f"Commander not found: {commander_name}")
    return row_to_location(row)


def reconcile_all_commanders() -> list[LocationOut]:
    init_metis_location_db()
    with connect() as conn:
        names = [
            r["commander_name"]
            for r in conn.execute("SELECT commander_name FROM metis_location_commanders ORDER BY commander_name").fetchall()
        ]
    return [reconcile_commander(name) for name in names]


def save_location_report(payload: LocationReportIn) -> LocationOut:
    init_metis_location_db()
    observed_at = normalize_timestamp(payload.observed_at)
    system_name = payload.system_name.strip() if payload.system_name else None
    source = payload.source.value
    if not system_name:
        source = LocationSource.UNKNOWN.value

    with connect() as conn:
        ensure_commander(conn, payload.commander_name)
        conn.execute(
            """
            INSERT INTO metis_location_reports
              (commander_name, system_name, station_name, ship_type, source, source_detail,
               observed_at, received_at, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload.commander_name,
                system_name,
                payload.station_name,
                payload.ship_type,
                source,
                payload.source_detail,
                observed_at,
                utc_now_iso(),
                payload.notes,
            ),
        )
    return reconcile_commander(payload.commander_name)


def counts_for(locations: list[LocationOut]) -> dict[str, int]:
    result = {"live": 0, "recent": 0, "last_known": 0, "unknown": 0, "total": len(locations)}
    for loc in locations:
        result[loc.confidence] = result.get(loc.confidence, 0) + 1
    return result


@router.get("/health", response_model=ModuleHealthOut)
def health() -> ModuleHealthOut:
    return ModuleHealthOut(
        ok=True,
        module="METIS Location Sharing Module",
        phase="Phase 1 / Layer 1 - Location",
        update_cadence_seconds=UPDATE_CADENCE_SECONDS,
        live_window_minutes=LIVE_WINDOW_MINUTES,
        api_fresh_minutes=API_FRESH_MINUTES,
        recent_still_minutes=RECENT_STILL_MINUTES,
    )


@router.post("/commanders", response_model=LocationOut, status_code=201)
def upsert_commander(payload: CommanderIn) -> LocationOut:
    init_metis_location_db()
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO metis_location_commanders
              (commander_name, display_name, squadron_role, sharing_enabled, notes, updated_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(commander_name) DO UPDATE SET
              display_name = COALESCE(excluded.display_name, metis_location_commanders.display_name),
              squadron_role = COALESCE(excluded.squadron_role, metis_location_commanders.squadron_role),
              sharing_enabled = excluded.sharing_enabled,
              notes = COALESCE(excluded.notes, metis_location_commanders.notes),
              updated_at = datetime('now')
            """,
            (
                payload.commander_name,
                payload.display_name,
                payload.squadron_role,
                1 if payload.sharing_enabled else 0,
                payload.notes,
            ),
        )
    return reconcile_commander(payload.commander_name)


@router.post("/reports", response_model=LocationOut)
def report_location(payload: LocationReportIn) -> LocationOut:
    return save_location_report(payload)


@router.post("/reports/api", response_model=LocationOut)
def report_api_location(payload: LocationReportIn) -> LocationOut:
    if payload.source.value not in API_PRIORITY_SOURCES:
        raise HTTPException(status_code=400, detail="API reports must use api_inara, api_eddn, edmc, or srv_survey.")
    return save_location_report(payload)


@router.post("/reports/journal", response_model=LocationOut)
def report_journal_location(payload: LocationReportIn) -> LocationOut:
    payload.source = LocationSource.JOURNAL
    return save_location_report(payload)


@router.post("/refresh-all", response_model=RefreshOut)
def refresh_all() -> RefreshOut:
    locations = reconcile_all_commanders()
    return RefreshOut(ok=True, refreshed=len(locations), locations=locations)


@router.get("/locations", response_model=list[LocationOut])
def locations(include_hidden: bool = Query(False)) -> list[LocationOut]:
    reconcile_all_commanders()
    init_metis_location_db()
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT c.commander_name, c.display_name, c.squadron_role, c.sharing_enabled,
                   l.system_name, l.station_name, l.ship_type, l.source, l.source_detail,
                   l.confidence, l.observed_at, l.received_at, l.reconciled_at, l.notes
            FROM metis_location_commanders c
            LEFT JOIN metis_current_locations l ON l.commander_name = c.commander_name
            WHERE (? = 1 OR c.sharing_enabled = 1)
            ORDER BY
              CASE COALESCE(l.confidence, 'unknown')
                WHEN 'live' THEN 1
                WHEN 'recent' THEN 2
                WHEN 'last_known' THEN 3
                ELSE 4
              END,
              c.commander_name
            """,
            (1 if include_hidden else 0,),
        ).fetchall()
    return [row_to_location(row) for row in rows]


@router.get("/board", response_model=SquadronBoardOut)
def squadron_board() -> SquadronBoardOut:
    locs = locations(include_hidden=False)
    return SquadronBoardOut(
        module="METIS Location Sharing Module",
        phase="Phase 1 / Layer 1 - Location",
        generated_at=utc_now_iso(),
        update_cadence_seconds=UPDATE_CADENCE_SECONDS,
        source_priority=["api_inara", "api_eddn", "edmc", "srv_survey", "journal", "best_guess", "unknown"],
        counts=counts_for(locs),
        commanders=locs,
    )


async def reconciliation_loop() -> None:
    while True:
        try:
            reconcile_all_commanders()
        except Exception:
            # Keep the loop alive. Host app logging can wrap this if desired.
            pass
        await asyncio.sleep(UPDATE_CADENCE_SECONDS)


def register_metis_location_sharing(app: FastAPI, *, start_background_reconciler: bool = False) -> None:
    """Optional helper for the host app.

    This function is not called automatically. The project owner must explicitly mount it.
    """
    init_metis_location_db()
    app.include_router(router)

    if start_background_reconciler:
        @app.on_event("startup")
        async def _start_metis_reconciler() -> None:
            asyncio.create_task(reconciliation_loop())
