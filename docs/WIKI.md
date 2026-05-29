# Water Bubble – Dev Wiki

## 0) Wie benutze ich dieses Wiki?
- **Suche nach Tokens** wie `[MK-01]` mit `Ctrl+Shift+F`
- Klicke Dateilinks (öffnet in VS Code)
- Ergänze neue Themen immer als:
  1) Token im Code
  2) Abschnitt hier im Wiki

  ## 0.1 Wie arbeite ich mit Patch-Anweisungen (Laien-Modus)
1) Problem in einem Satz + Screenshot beschreiben
2) Prüfen: **Datei**, **Token**, **genaue Änderung**
3) Nur diesen Teil ändern und testen (`npm run dev`)
4) Wenn besser: behalten. Wenn schlechter: Änderung rückgängig machen
5) Erst wenn stabil: nächstes Thema


## 1) Dateien & Zuständigkeiten
## 1.1 src/main.ts – Überblick (Execution Flow)

### Startfolge
1) `[BOOT-01] bootstrap()`  
   - UI initialisieren (Economy-Liste), Canvas-Sizing, CSV laden  
   - Graph bauen, initiales Framing, Stats initial  
2) `[LOOP-01] tick()`  
   - per Frame: Controls, Grid, Marker-Scaling, Render

### Hotspots (Performance / “fühlt sich gut an”)
- `[GFX-02] resizeToSlot()` (wichtig, aber teuer wenn pro Frame)
- `[SEL-01] pick()` (Raycast + intersect)
- `[MK-03] updateMarkerScales()` (per Marker pro Frame)

## 1.2 [CFG-01] Tuning constants (deine “Slider”)

| Konstante | Wirkung | Typische Symptome | Empfehlung |
|---|---|---|---|
| `CAMERA_FOV` | Perspektive (Weitwinkel vs Tele) | zu “flach” oder zu “fischig” | 45–65 |
| `CAMERA_NEAR/FAR` | Clipping | Marker verschwinden | Near nicht zu groß |
| `MARKER_PIXEL_SIZE` | Marker wirken größer/kleiner am Screen | Marker zu dominant/zu klein | 24–44 |
| `MARKER_BASE_WORLD` | Untergrenze Markergröße | Marker “brechen” bei Zoom | 6–12 |
| `DEFAULT_K_NEIGHBORS` | Graph-Dichte | zu wenige/zu viele Links | 2–5 |
| `DEFAULT_LINK_MAX_DIST` | Link-Radius | Graph reißt auseinander | 35–60 |
| `STAR_COUNT` | Starfield-Dichte | Performance / zu “leer” | 800–4000 |
| `STAR_RADIUS` | Parallax/Umgebung | Sterne zu nah/zu weit | 1500–4000 |

## 1.3 Token-Details (src/main.ts)
## 1.3 Token-Details (src/main.ts) – Laien-Erklärung

### [GFX-02] Resize auf slotCenter (Canvas passt genau ins große Display)
**Wofür ist das?**  
Damit die 3D-Ansicht exakt in den mittleren “blauen Bereich” passt – und damit Hover/Klick an der richtigen Stelle passiert.

**Wo im Code?**  
`src/main.ts` → Suche nach `[GFX-02]`

**Was darf ich ändern?**  
Nichts “kreatives” – das ist eher eine technische Grundlage.

**Woran merke ich ein Problem?**  
- Tooltip steht neben dem Cursor  
- Klick trifft das falsche System  
- Ansicht wirkt “verschoben” oder “verzogen”

**Standard-Fix (wenn es ruckelt / nicht smooth ist):**  
Wenn irgendwo steht, dass `resizeToSlot()` in einer dauernden Schleife läuft (tick), macht es oft das Bild “zäher”. Dann muss man es so umbauen, dass es nur bei Fenstergröße-Änderung läuft. (Das mache ich dir, wenn wir dran sind.)

---

### [MK-02] Economy→Color Mapping (Farben der Marker gemäß Legende)
**Wofür ist das?**  
Das ist die “Farben-Identität” (Industrial gelb, Extraction rot, usw.).  
Wenn hier etwas nicht passt, werden Marker grau/weiß oder falsch gefärbt.

**Wo im Code?**  
`src/main.ts` → Suche nach `[MK-02]`

**Was darf ich ändern?**  
Die Farben in `ECON_COLORS` (Hex-Farben wie `#ff4b4b`).

**Woran merke ich ein Problem?**  
- Marker sind plötzlich überwiegend “Unknown” / grau  
- Legend-Farbe und Marker-Farbe passen nicht zusammen

**Standard-Fix:**  
Wenn in der CSV die Economy anders geschrieben ist (z.B. “HighTech” statt “High Tech”), dann wird sie nicht erkannt und fällt auf “Unknown” zurück.  
Dann muss man entweder die CSV-Schreibweise angleichen oder in `economyKeyOf()` Varianten abfangen.

---

### [SEL-01] Pick / Klick-Auswahl (welches System wird getroffen)
**Wofür ist das?**  
Das ist die Funktion, die beim Klicken entscheidet: “Welches System habe ich angeklickt?”

**Wo im Code?**  
`src/main.ts` → Suche nach `[SEL-01]`

**Was darf ich ändern?**  
Nichts ohne Anleitung – sonst wird Auswahl kaputt.

**Woran merke ich ein Problem?**  
- Klick “wählt nichts”  
- Klick wählt “irgendwas anderes”  
- Klick funktioniert, aber fühlt sich träge an

**Standard-Fix:**  
Wenn das System träge wird: Diese Klick-/Hover-Logik muss optimiert werden (nicht jedes Mal alles neu berechnen). Das ist eine typische Performance-Stelle. (Mache ich dir.)

---

### [HOV-02] Tooltip Placement (Tooltip sitzt richtig am Cursor)
**Wofür ist das?**  
Damit der Tooltip wirklich neben dem Mauszeiger erscheint – und nicht versetzt.

**Wo im Code?**  
`src/main.ts` → Suche nach `[HOV-02]`

**Was darf ich ändern?**  
Nur den “Abstand” (Padding), wenn du willst (z.B. 12 → 20).

**Woran merke ich ein Problem?**  
- Tooltip steht weit weg vom Cursor  
- Tooltip “wandert” beim Bewegen falsch

**Standard-Fix:**  
Das hängt davon ab, ob Tooltip “relativ zum Fenster” oder “relativ zum mittleren Screen” positioniert wird. Wenn das nicht zusammenpasst, ist er versetzt. Das ist meistens ein CSS/Position-Problem (nicht dein Fehler).

### [GFX-02] Resize auf slotCenter
- Zweck: Canvas exakt auf Monitorfläche → Hover/Click korrekt
- Regler: indirekt (DOM/Layout)
- Risiko: Wenn in `tick()` aufgerufen → Layout-Thrashing / Performanceverlust

### [MK-02] Economy→Color Mapping
- Zweck: Farb-Identität pro Economy (Legende)
- Regler: `ECON_COLORS`, `economyKeyOf()`
- Risiko: CSV-Werte weichen ab (“HighTech” vs “High Tech”) → alles wird “Unknown” (grau/weiß)

### [SEL-01] Pick / Raycast
- Zweck: Klick/hover trifft Sprite
- Risiko: Wenn pro `pointermove` jedes Mal `nodes.map()` + raycast → kann “zäh” werden

### [HOV-02] Tooltip Placement
- Zweck: Tooltip sitzt da, wo Cursor ist
- Risiko: falscher Bezug (window vs slot) → Tooltip “versetzt”

- [src/main.ts](../src/main.ts) – Rendering, Szene, Interaktion, UI-Wiring
- [src/systems.ts](../src/systems.ts) – CSV-Laden + Datenmodell
- [src/style.css](../src/style.css) – UI/Panel-Styling, Scroll, Layout
- [index.html](../index.html) – DOM-Struktur (Slots, Panels)
- [public/console_frame.png](../public/console_frame.png) – Frame/Overlay
- [public/systems-search-Waterbubble.csv](../public/systems-search-Waterbubble.csv) – Systemdaten

## 2) Marker-Index (Tokens)
### Layout / Safe Zones
- `[LAY-01]` Safe zones (Viewport/Monitore/Keyboard)
- `[LAY-02]` “Monitor-Perspektive” per CSS (rotate/tilt)

### 3D / Rendering
- `[GFX-01]` Renderer (alpha, pixel ratio, resize)
- `[GFX-02]` Starfield (echte 3D points)
- `[CAM-01]` Kamera + OrbitControls + Default framing
- `[GRID-01]` Grid global + “billboarding” / facing camera

### Marker (System-Fadenkreuze)
- `[MK-01]` Marker-Textur (bunt, crosshair, ring)
- `[MK-02]` Economy-Farbcode (Legend mapping)
- `[MK-03]` Marker-Scaling vs Zoom

### Hover / Selection
- `[HOV-01]` Hover Raycast
- `[HOV-02]` Tooltip placement (korrekte Position im Slot)
- `[SEL-01]` Click picking / Selected state

### UI Panels
- `[UI-01]` Left panel scroll + filter toggles
- `[UI-02]` Right panel stats (global vs selected)
- `[UI-03]` Console buttons / status line
- `[SPN-01]` Spansh Proxy Button (CSV export + live load)
**Wofür ist das?**  
Lädt Systeme direkt vom Spansh-Proxy (optional mit CSV-Export). Der Button fragt nach Referenzsystem und Radius und kann die CSV im `public/`-Ordner speichern.

**Wo im Code?**  
`src/main.ts` → Suche nach `[SPN-01]`

**Was darf ich ändern?**  
- Default-Referenzsystem und Radius (Konstanten `[SPN-00]`)  
- Button-Text oder Hinweistexte in den Prompts

**Woran merke ich ein Problem?**  
- Button meldet „Proxy nicht erreichbar“ → Proxy nicht gestartet  
- Keine Systeme sichtbar → Parameter falsch oder Spansh liefert leer
## 3) Arbeitsweise (wichtig)
Wenn wir etwas ändern:
1) Token im Code prüfen/setzen
2) Wiki-Abschnitt ergänzen: **Was? Wo? Welche Parameter? Risiken?**
3) Erst dann Code ändern

### Quick: "Get Systems" (In-Game Pull)
- There is a "Get Systems" button in the console (bottom-left of the page).
- It can call a local proxy: run `node scripts/server/spansh-proxy.mjs` (Node 18+) and then click the button. Provide reference + radius when prompted.
- Alternatively choose CSV: paste a Spansh CSV URL or leave blank to load the bundled CSV.
- If the button is not visible: check console for JS errors, and ensure the app bundle with the above changes is loaded; start the proxy if using proxy mode.

### [SPN-01] Spansh Proxy Button (CSV export + live load)
**Wofür ist das?**  
Lädt Systeme direkt vom Spansh-Proxy (optional mit CSV-Export). Der Button fragt nach Referenzsystem und Radius und kann die CSV im `public/`-Ordner speichern.

**Wo im Code?**  
`src/main.ts` → Suche nach `[SPN-01]`

**Was darf ich ändern?**  
- Default-Referenzsystem und Radius (Konstanten `[SPN-00]`)  
- Button-Text oder Hinweistexte in den Prompts

**Woran merke ich ein Problem?**  
- Button meldet „Proxy nicht erreichbar“ → Proxy nicht gestartet  
- Keine Systeme sichtbar → Parameter falsch oder Spansh liefert leer
