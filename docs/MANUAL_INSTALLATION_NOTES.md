# Manual Installation Notes

This is a module-only package.

## Important

Do not copy these files into the active branch or mount the router until Tsumikaze explicitly approves integration.

## Suggested branch workflow

1. Create a new branch in GitHub Desktop.
2. Copy only the METIS files into that branch.
3. Review the code before mounting it.
4. Manually mount the router in the backend only after approval.
5. Run the backend and test `/api/metis/location-sharing/health`.
6. Start one local agent and confirm the board updates.

## Suggested placement

```text
backend/app/metis_location_db.py
backend/app/metis_location_sharing.py
tools/metis_location_agent.py
tools/edmc_metis_plugin/load.py
frontend/metis-location-board.html
src/metisLocationSharingClient.ts
src/metisLocationSharingPanel.ts
src/metisLocationSharingPanel.css
```

## Manual mount example

```python
from .metis_location_sharing import register_metis_location_sharing

register_metis_location_sharing(app, start_background_reconciler=True)
```

## Test curl

```bash
curl http://127.0.0.1:8000/api/metis/location-sharing/health
```

```bash
curl -X POST http://127.0.0.1:8000/api/metis/location-sharing/commanders \
  -H "Content-Type: application/json" \
  -d '{"commander_name":"Tsumikaze","display_name":"Tsumikaze","squadron_role":"Architect"}'
```

```bash
curl -X POST http://127.0.0.1:8000/api/metis/location-sharing/reports/journal \
  -H "Content-Type: application/json" \
  -d '{"commander_name":"Tsumikaze","system_name":"Col 285 Sector FI-J c9-12","ship_type":"Type-9 Heavy","source":"journal"}'
```

```bash
curl http://127.0.0.1:8000/api/metis/location-sharing/board
```
