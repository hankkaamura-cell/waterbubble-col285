export type MetisConfidence = "live" | "recent" | "last_known" | "unknown";

export interface MetisLocation {
  commander_name: string;
  display_name?: string | null;
  squadron_role?: string | null;
  sharing_enabled: boolean;
  system_name?: string | null;
  station_name?: string | null;
  ship_type?: string | null;
  source: string;
  source_detail?: string | null;
  confidence: MetisConfidence;
  observed_at?: string | null;
  received_at?: string | null;
  reconciled_at?: string | null;
  age_minutes?: number | null;
  notes?: string | null;
}

export interface MetisBoard {
  module: string;
  phase: string;
  generated_at: string;
  update_cadence_seconds: number;
  source_priority: string[];
  counts: Record<string, number>;
  commanders: MetisLocation[];
}

export async function fetchMetisLocationBoard(apiBase = "http://127.0.0.1:8000"): Promise<MetisBoard> {
  const url = `${apiBase.replace(/\/$/, "")}/api/metis/location-sharing/board`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`METIS board request failed: HTTP ${response.status}`);
  }
  return response.json() as Promise<MetisBoard>;
}
