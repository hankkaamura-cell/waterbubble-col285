# Backend/Proxy starten

Damit das Frontend Daten laden kann, muss der Backend-Proxy laufen.  
So gehst du vor:

## 1. Voraussetzungen

- Node.js installiert (`node -v` prüfen)
- Abhängigkeiten installiert (im Projektordner):

  ```sh
  npm install
  ```

## 2. Proxy starten

Im Projektordner:

```sh
node scripts/server/spansh-proxy.mjs
```

- Der Proxy lauscht dann auf `http://localhost:8787`
- Die Endpunkte `/api/spansh/systems` und `/api/spansh/export` müssen erreichbar sein.

## 3. Typische Fehlerquellen

- Port 8787 ist schon belegt → anderen Prozess beenden oder Port ändern.
- Fehlende Abhängigkeiten → `npm install` ausführen.
- Keine Internetverbindung → Proxy kann keine Daten von spansh.co.uk holen.

## 4. Test

Im Browser:

- `http://localhost:8787/api/spansh/ping` sollte `pong` oder einen 200-Status liefern.
- `http://localhost:8787/api/spansh/systems?reference=Sol&radius=1` sollte JSON liefern.

## 5. Hinweise

- Das Frontend zeigt "Backend proxy not reachable", wenn der Proxy nicht läuft.
- Starte den Proxy immer vor dem Frontend.

---
