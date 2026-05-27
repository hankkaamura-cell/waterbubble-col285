from __future__ import annotations

from typing import Any
from .db import connect

PAD_RANK = {"S": 1, "M": 2, "L": 3, None: 0, "": 0}

COLONIZATION_COMMODITIES = {
    "Liquid Oxygen", "Water", "Aluminium", "Copper", "Steel", "Titanium",
    "CMM Composite", "Ceramic Composites", "Insulating Membrane", "Polymers",
    "Semiconductors", "Superconductors", "Computer Components",
    "Structural Regulators", "Surface Stabilisers", "Building Fabricators",
    "Emergency Power Cells", "Medical Diagnostic Equipment", "Robotics",
    "Micro Controllers", "Food Cartridges", "Fruit and Vegetables",
    "Basic Medicines", "Agri-Medicines", "Pesticides", "Water Purifiers"
}


def _required_pad_ok(station_pad: str | None, required: str) -> bool:
    return PAD_RANK.get((station_pad or "").upper(), 0) >= PAD_RANK.get(required.upper(), 0)


def find_trade_loops(
    cargo_capacity: int = 784,
    required_pad: str = "L",
    max_age_hours: int = 48,
    commodity: str | None = None,
    colonization_only: bool = False,
    min_profit_per_ton: int = 1,
    include_carriers: bool = False,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """
    Computes simple one-hop station-to-station trade opportunities.

    Journal/EDDN market convention:
      sellPrice = station sells to CMDR
      buyPrice  = station buys from CMDR

    Profit:
      profit_per_ton = destination buyPrice - origin sellPrice
    """
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT
              s.market_id,
              s.system_name,
              s.station_name,
              s.station_type,
              s.max_pad_size,
              s.distance_to_arrival_ls,
              s.updated_at AS station_updated_at,
              c.commodity_name,
              c.buy_price,
              c.sell_price,
              c.supply,
              c.demand,
              c.updated_at AS commodity_updated_at
            FROM commodities c
            JOIN stations s ON s.market_id = c.market_id
            WHERE datetime(c.updated_at) >= datetime('now', ?)
            """,
            (f"-{int(max_age_hours)} hours",),
        ).fetchall()

    markets_by_commodity: dict[str, list[dict[str, Any]]] = {}
    for r in rows:
        item = dict(r)

        if commodity and item["commodity_name"].lower() != commodity.lower():
            continue

        if colonization_only and item["commodity_name"] not in COLONIZATION_COMMODITIES:
            continue

        if not _required_pad_ok(item.get("max_pad_size"), required_pad):
            continue

        if not include_carriers and (item.get("station_type") or "").lower() in {"fleet carrier", "carrier"}:
            continue

        markets_by_commodity.setdefault(item["commodity_name"], []).append(item)

    opportunities: list[dict[str, Any]] = []

    for commodity_name, markets in markets_by_commodity.items():
        exporters = [m for m in markets if int(m.get("supply") or 0) > 0 and int(m.get("sell_price") or 0) > 0]
        importers = [m for m in markets if int(m.get("demand") or 0) > 0 and int(m.get("buy_price") or 0) > 0]

        for origin in exporters:
            for dest in importers:
                if origin["market_id"] == dest["market_id"]:
                    continue

                profit_per_ton = int(dest["buy_price"]) - int(origin["sell_price"])
                if profit_per_ton < min_profit_per_ton:
                    continue

                tons = min(
                    int(origin["supply"] or 0),
                    int(dest["demand"] or 0),
                    int(cargo_capacity),
                )

                if tons <= 0:
                    continue

                opportunities.append(
                    {
                        "commodity": commodity_name,
                        "fromSystem": origin["system_name"],
                        "fromStation": origin["station_name"],
                        "fromMarketId": origin["market_id"],
                        "fromPad": origin["max_pad_size"],
                        "fromDistanceLs": origin["distance_to_arrival_ls"],
                        "toSystem": dest["system_name"],
                        "toStation": dest["station_name"],
                        "toMarketId": dest["market_id"],
                        "toPad": dest["max_pad_size"],
                        "toDistanceLs": dest["distance_to_arrival_ls"],
                        "buyFromOriginAt": int(origin["sell_price"]),
                        "sellToDestinationAt": int(dest["buy_price"]),
                        "originSupply": int(origin["supply"] or 0),
                        "destinationDemand": int(dest["demand"] or 0),
                        "profitPerTon": profit_per_ton,
                        "tons": tons,
                        "estimatedProfit": profit_per_ton * tons,
                        "originUpdatedAt": origin["commodity_updated_at"],
                        "destinationUpdatedAt": dest["commodity_updated_at"],
                    }
                )

    opportunities.sort(key=lambda x: (x["estimatedProfit"], x["profitPerTon"]), reverse=True)
    return opportunities[:limit]
