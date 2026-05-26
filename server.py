# =========================================================
# Water Bubble – Spansh Proxy Server
# =========================================================
# Starten: python server.py
# Läuft auf: http://localhost:8787
# =========================================================

import json
import csv
import os
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # erlaubt Anfragen vom Browser (localhost:5173)

# =========================================================
# Konfiguration
# =========================================================
SPANSH_BASE = "https://spansh.co.uk/api"

# Pfad zur CSV (relativ zu server.py, also im Projektordner)
# Vite liest aus /public → dort muss die CSV liegen
PUBLIC_DIR = os.path.join(os.path.dirname(__file__), "public")


# =========================================================
# Hilfsfunktionen
# =========================================================

def spansh_search(reference: str, radius: float) -> list:
    """Holt nur kolonisierte Systeme von Spansh."""
    url = f"{SPANSH_BASE}/systems/search"
    payload = {
        "filters": {
            "reference_system": reference,
            "distance": {"value": radius, "comparison": "<="},
            "is_colonised": {"value": 1, "comparison": "="}
        },
        "sort": [{"distance": {"direction": "asc"}}],
        "size": 500,
        "page": 0
    }

    resp = requests.post(url, json=payload, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    results = data.get("results", [])

    # Sicherheitsnetz: nochmal lokal filtern
    return [s for s in results if s.get("is_colonised") or s.get("colonised")]


def spansh_to_record(s: dict) -> dict:
    """Wandelt einen Spansh-Systemeintrag in das SystemRecord-Format um."""
    bodies_raw = s.get("bodies", [])
    stations_raw = s.get("stations", [])

    # PlanetClass: Priorität Earth-like > Water > Ammonia > Other
    planet_class = "Other"
    for b in bodies_raw:
        subtype = str(b.get("subtype", "")).lower()
        if "earth-like" in subtype or "earth like" in subtype:
            planet_class = "Earth-like World"
            break
        if "water world" in subtype:
            planet_class = "Water World"
        if "ammonia world" in subtype and planet_class != "Water World":
            planet_class = "Ammonia World"

    return {
        "name":         s.get("name", ""),
        "x":            s.get("x", 0),
        "y":            s.get("y", 0),
        "z":            s.get("z", 0),
        "distanceLy":   s.get("distance", None),
        "economy":      s.get("primary_economy", s.get("economy", "Unknown")),
        "planetClass":  planet_class,
        "faction":      s.get("controlling_minor_faction", None),
        "factionState": s.get("controlling_minor_faction_state", None),
        "allegiance":   s.get("allegiance", None),
        "colonised":    bool(s.get("is_colonised") or s.get("colonised", False)),
        "needsPermit":  s.get("needs_permit", False),
        "bodies":       len(bodies_raw),
        "stations":     len(stations_raw),
    }


def save_csv(systems: list, filename: str = "systems-search-Waterbubble.csv") -> str:
    """Speichert die Systeme als CSV in den /public Ordner."""
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    path = os.path.join(PUBLIC_DIR, filename)

    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f, quoting=csv.QUOTE_ALL)
        writer.writerow([
            "Name", "Distance (LY)", "Controlling Faction",
            "Needs Permit", "Bodies", "Colonised", "Economy",
            "Stations", "X", "Y", "Z",
            "Controlling Faction State", "Allegiance"
        ])
        for s in systems:
            writer.writerow([
                s.get("name", ""),
                s.get("distanceLy", ""),
                s.get("faction", ""),
                s.get("needsPermit", False),
                s.get("bodies", 0),   # Zahl, kein JSON
                s.get("colonised", False),
                s.get("economy", "Unknown"),
                s.get("stations", 0), # Zahl, kein JSON
                s.get("x", 0),
                s.get("y", 0),
                s.get("z", 0),
                s.get("factionState", ""),
                s.get("allegiance", ""),
            ])

    print(f"[server] CSV gespeichert: {path} ({len(systems)} Systeme)")
    return f"/{filename}"


# =========================================================
# Endpunkte
# =========================================================

@app.route("/api/spansh/ping")
def ping():
    """Health-Check – wird vom Browser alle paar Sekunden gerufen."""
    return "pong", 200


@app.route("/api/spansh/systems")
def get_systems():
    """Holt aktuelle Systemdaten von Spansh und gibt sie als JSON zurück."""
    reference = request.args.get("reference", "Col 285 Sector FI-J c9-2")
    radius    = float(request.args.get("radius", 75))

    try:
        raw     = spansh_search(reference, radius)
        systems = [spansh_to_record(s) for s in raw]
        return jsonify({"systems": systems})

    except Exception as e:
        print(f"[server] Fehler beim Spansh-Abruf: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/spansh/export")
def export_systems():
    """Holt Daten von Spansh und speichert sie zusätzlich als CSV."""
    reference = request.args.get("reference", "Col 285 Sector FI-J c9-2")
    radius    = float(request.args.get("radius", 75))
    output    = request.args.get("output", "systems-search-Waterbubble.csv")

    try:
        raw     = spansh_search(reference, radius)
        systems = [spansh_to_record(s) for s in raw]
        csv_url = save_csv(systems, output)
        return jsonify({"systems": systems, "csvUrl": csv_url})

    except Exception as e:
        print(f"[server] Fehler beim Export: {e}")
        return jsonify({"error": str(e)}), 500


# =========================================================
# Start
# =========================================================
if __name__ == "__main__":
    print("=" * 50)
    print("Water Bubble – Spansh Proxy")
    print("Läuft auf: http://localhost:8787")
    print("=" * 50)
    app.run(host="0.0.0.0", port=8787, debug=False)
