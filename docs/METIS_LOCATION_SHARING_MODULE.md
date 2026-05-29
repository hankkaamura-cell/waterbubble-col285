# METIS Location Sharing Module Design

## Phase

Project METIS, Phase 1, Layer 1: **Location Layer**

## Non-goals

This module does not implement Phase 2 activity tracking or Phase 3 OTA/live squadron sync.

It does not automatically alter the Water Bubble project.

## Data flow

```text
CMDR machine
  -> optional API/bridge probe
  -> local Elite journal fallback
  -> local best-guess cache
  -> METIS backend report endpoint
  -> squadron board endpoint
  -> frontend board
```

## Source decision logic

```text
Fresh api_inara/api_eddn/edmc/srv_survey report
  wins if observed_at is <= 15 minutes old

Otherwise latest journal report
  wins if any local commander log location exists

Otherwise best_guess
  uses the last cached known location from the local agent or backend report history

Otherwise unknown
  no location can be inferred
```

## Why this is local-first

A central server cannot directly read every CMDR's local Elite Dangerous journal files. Each participating CMDR needs one of these:

- the included `metis_location_agent.py`
- the included EDMC plugin proof-of-shape
- a future SRV Survey bridge
- a future INARA/EDDN-aware bridge that returns current-location JSON

## Minimal backend files

Place these in the backend app package when approved:

```text
metis_location_db.py
metis_location_sharing.py
```

Then manually mount the router only after approval.
