# Architecture

## Recommended data flow

```txt
Spansh export / Water Bubble planning list
        ↓
systems table
        ↓
map nodes

EDDN commodity stream
        ↓
market/station filter
        ↓
stations + commodities tables
        ↓
trade-loop endpoint
        ↓
map overlays / trade table
```

## Why EDDN for market data?

EDDN receives live data submitted by commanders using tools like EDMC, EDDiscovery, EDDI, etc. It does not store the current galaxy state itself, so this backend stores only the Water Bubble subset that matters.

## Why not direct Inara market scraping?

Do not scrape Inara. It is not necessary, it is brittle, and it may violate terms. Use EDDN or legitimate data dumps/exports.

## What Inara can still do

The included `InaraClient` is useful for optional commander/profile-style features if the project eventually adds login or identity.

Examples:

- validate a CMDR profile
- link to a commander's Inara profile
- link to station/market pages returned by documented events

It is not the core market feed.
