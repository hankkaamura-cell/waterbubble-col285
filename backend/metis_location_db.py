from __future__ import annotations

import os
import sqlite3
from pathlib import Path

DEFAULT_DB_NAME = "metis_location_sharing.sqlite3"


def default_db_path() -> Path:
    """Return the METIS database path.

    This module is intentionally standalone. It does not modify the host Water Bubble
    database unless METIS_DB_PATH is explicitly pointed there by the project owner.
    """
    configured = os.getenv("METIS_DB_PATH")
    if configured:
        return Path(configured).expanduser().resolve()

    base = os.getenv("METIS_DATA_DIR")
    if base:
        data_dir = Path(base).expanduser().resolve()
    else:
        data_dir = Path.cwd() / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir / DEFAULT_DB_NAME


def connect(db_path: str | Path | None = None) -> sqlite3.Connection:
    path = Path(db_path).expanduser().resolve() if db_path else default_db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn
