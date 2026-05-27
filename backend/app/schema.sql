PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS systems (
  name TEXT PRIMARY KEY,
  x REAL NOT NULL,
  y REAL NOT NULL,
  z REAL NOT NULL,
  economy TEXT,
  colonised INTEGER DEFAULT 0,
  faction TEXT,
  allegiance TEXT,
  faction_state TEXT,
  planet_class TEXT,
  body_count INTEGER,
  station_count INTEGER,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS stations (
  market_id INTEGER PRIMARY KEY,
  system_name TEXT NOT NULL,
  station_name TEXT NOT NULL,
  station_type TEXT,
  max_pad_size TEXT,
  distance_to_arrival_ls REAL,
  updated_at TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'unknown'
);

CREATE TABLE IF NOT EXISTS commodities (
  market_id INTEGER NOT NULL,
  commodity_name TEXT NOT NULL,
  buy_price INTEGER DEFAULT 0,
  sell_price INTEGER DEFAULT 0,
  supply INTEGER DEFAULT 0,
  demand INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'unknown',
  PRIMARY KEY (market_id, commodity_name),
  FOREIGN KEY (market_id) REFERENCES stations(market_id)
);

CREATE INDEX IF NOT EXISTS idx_stations_system ON stations(system_name);
CREATE INDEX IF NOT EXISTS idx_commodities_name ON commodities(commodity_name);
CREATE INDEX IF NOT EXISTS idx_commodities_updated ON commodities(updated_at);
