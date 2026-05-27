from __future__ import annotations

from datetime import datetime, timezone
import os
from typing import Any

import httpx


INARA_API_URL = "https://inara.cz/inapi/v1/"


class InaraClient:
    """
    Thin Inara API helper.

    Important:
      This is NOT a public market-data importer.
      Inara's documented API is useful for commander/profile/log-style integrations,
      and EDMC can send data to Inara when configured with a user's API key.
      For public station commodity loops, use EDDN and/or a trusted market data dump.
    """

    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key or os.getenv("INARA_API_KEY", "")
        self.app_name = os.getenv("INARA_APP_NAME", "WaterBubbleMap")
        self.app_version = os.getenv("INARA_APP_VERSION", "0.1.0")

    def build_payload(self, events: list[dict[str, Any]]) -> dict[str, Any]:
        if not self.api_key:
            raise RuntimeError("INARA_API_KEY is not set.")

        return {
            "header": {
                "appName": self.app_name,
                "appVersion": self.app_version,
                "isDeveloped": True,
                "APIkey": self.api_key,
            },
            "events": events,
        }

    async def send_events(self, events: list[dict[str, Any]]) -> dict[str, Any]:
        payload = self.build_payload(events)
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(INARA_API_URL, json=payload)
            response.raise_for_status()
            return response.json()

    async def get_commander_profile(self, search_name: str) -> dict[str, Any]:
        event = {
            "eventName": "getCommanderProfile",
            "eventTimestamp": datetime.now(timezone.utc).isoformat(),
            "eventData": {"searchName": search_name},
        }
        return await self.send_events([event])
