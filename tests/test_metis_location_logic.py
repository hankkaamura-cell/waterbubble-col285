from __future__ import annotations

from datetime import timedelta

from backend.metis_location_sharing import confidence_for, utc_now


def test_unknown_without_system():
    assert confidence_for(None, utc_now().isoformat()) == "unknown"


def test_live_window():
    assert confidence_for("Sol", (utc_now() - timedelta(minutes=5)).isoformat()) == "live"


def test_recent_window():
    assert confidence_for("Sol", (utc_now() - timedelta(minutes=90)).isoformat()) == "recent"


def test_last_known_window():
    assert confidence_for("Sol", (utc_now() - timedelta(hours=9)).isoformat()) == "last_known"
