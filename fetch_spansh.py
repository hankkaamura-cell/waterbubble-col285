# =========================================================
# Water Bubble – Einmal-Skript: CSV von Spansh aktualisieren
# =========================================================
# Starten: python fetch_spansh.py
# Ergebnis: public/systems-search-Waterbubble.csv
# =========================================================

import requests
import csv
import json
import os

REFERENCE = "Col 285 Sector FI-J c9-2"
RADIUS    = 75
OUTPUT    = os.path.join("public", "systems-search-Waterbubble.csv")

# =========================================================
# Spansh-Abruf
# =========================================================
print(f"Lade Systeme von Spansh (Referenz: {REFERENCE}, Radius: {RADIUS} ly)...")

url = "https://spansh.co.uk/api/systems/search"
payload = {
    "filters": {
        "reference_system": REFERENCE,
        "distance": {"value": RADIUS, "comparison": "<="}
    },
    "sort": [{"distance": {"direction": "asc"}}],
    "size": 500,
    "page": 0
}

resp = requests.post(url, json=payload, timeout=30)
resp.raise_for_status()
data     = resp.json()
systems  = data.get("results", [])

print(f"{len(systems)} Systeme gefunden.")

# =========================================================
# PlanetClass ermitteln
# =========================================================
def planet_class(bodies: list) -> str:
    result = "Other"
    for b in bodies:
        subtype = str(b.get("subtype", "")).lower()
        if "earth-like" in subtype or "earth like" in subtype:
            return "Earth-like World"
        if "water world" in subtype:
            result = "Water World"
        if "ammonia world" in subtype and result != "Water World":
            result = "Ammonia World"
    return result

# =========================================================
# CSV schreiben
# =========================================================
os.makedirs("public", exist_ok=True)

with open(OUTPUT, "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f, quoting=csv.QUOTE_ALL)

    # Spalten genau so wie systems.ts sie erwartet
    writer.writerow([
        "Name", "Distance (LY)", "Controlling Faction",
        "Needs Permit", "Bodies", "Colonised", "Economy",
        "Stations", "X", "Y", "Z",
        "Controlling Faction State", "Allegiance"
    ])

    for s in systems:
        bodies_raw   = s.get("bodies", [])
        stations_raw = s.get("stations", [])

        writer.writerow([
            s.get("name", ""),
            s.get("distance", ""),
            s.get("controlling_minor_faction", ""),
            s.get("needs_permit", False),
            json.dumps(bodies_raw),    # JSON-Array (für planetClass-Erkennung)
            s.get("colonised", False),
            s.get("primary_economy", s.get("economy", "Unknown")),
            json.dumps(stations_raw),  # JSON-Array (für Stations-Zählung)
            s.get("x", 0),
            s.get("y", 0),
            s.get("z", 0),
            s.get("controlling_minor_faction_state", ""),
            s.get("allegiance", ""),
        ])

print(f"Gespeichert: {OUTPUT}")
