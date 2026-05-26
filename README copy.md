## Test: Spansh CSV Export

- Voraussetzungen: Node 18+ und `npm install papaparse` (falls noch nicht installiert).
- Einmaliger Export (Standard-Referenz & Radius) und Ausgabe nach public/:
  npm run spansh-export
- Automatischer Test (führt Export aus und zählt Zeilen):
  npm run test-spansh-export
- Ergebnis: `public/systems-spansh.csv` (anschliessend per "Get Systems" in der App laden oder umbenennen zu `/systems-search-Waterbubble.csv`).
