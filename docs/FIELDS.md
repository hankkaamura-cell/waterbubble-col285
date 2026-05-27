# Suggested Water Bubble Data Fields

## System

```json
{
  "name": "Col 285 Sector ...",
  "x": -344.0,
  "y": -79.656,
  "z": 38.031,
  "status": "colonized",
  "role": "Agriculture",
  "economy": "Tourism",
  "controllingFaction": "Colonia Citizens Network",
  "architect": "CMDR Name",
  "squadron": "Squadron Name",
  "lastUpdated": "2026-05-26T00:00:00Z",
  "source": "Spansh export / manual / EDDN / verified scouting"
}
```

## Station

```json
{
  "systemName": "System X",
  "stationName": "Station X",
  "marketId": 123456,
  "stationType": "Coriolis",
  "maxPadSize": "L",
  "distanceToArrivalLs": 450,
  "updatedAt": "2026-05-26T00:00:00Z",
  "source": "eddn"
}
```

## Commodity

```json
{
  "marketId": 123456,
  "commodityName": "Aluminium",
  "buyPrice": 3600,
  "sellPrice": 1100,
  "supply": 8000,
  "demand": 5000,
  "updatedAt": "2026-05-26T00:00:00Z",
  "source": "eddn"
}
```

## Trade loop formula

```txt
profit_per_ton = destination_buy_price - origin_sell_price
tons = min(origin_supply, destination_demand, cargo_capacity)
estimated_profit = profit_per_ton * tons
```
