import * as SQLite from "expo-sqlite";

export const db = SQLite.openDatabaseSync("mojemapy.db");

const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS rides (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'recorded',
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    distance REAL NOT NULL DEFAULT 0,
    moving_time REAL NOT NULL DEFAULT 0,
    total_time REAL NOT NULL DEFAULT 0,
    max_speed REAL NOT NULL DEFAULT 0,
    ascent REAL NOT NULL DEFAULT 0,
    descent REAL NOT NULL DEFAULT 0,
    max_alt REAL,
    bbox TEXT,
    preview TEXT,
    finished INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS ride_points (
    ride_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    segment INTEGER NOT NULL DEFAULT 0,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    alt REAL,
    speed REAL,
    course REAL,
    accuracy REAL,
    ts INTEGER NOT NULL,
    PRIMARY KEY (ride_id, seq)
  ) WITHOUT ROWID;
  CREATE TABLE IF NOT EXISTS waypoints (
    id TEXT PRIMARY KEY NOT NULL,
    ride_id TEXT NOT NULL,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    alt REAL,
    ts INTEGER NOT NULL,
    name TEXT,
    photo_uri TEXT
  );
  CREATE INDEX IF NOT EXISTS waypoints_ride ON waypoints(ride_id);
  CREATE TABLE IF NOT EXISTS routes (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    profile TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    distance REAL NOT NULL,
    duration REAL NOT NULL,
    ascent REAL NOT NULL DEFAULT 0,
    points TEXT NOT NULL,
    geometry TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS places (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    subtitle TEXT,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    category TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS recent_searches (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    subtitle TEXT,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    category TEXT,
    used_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS regions (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    version TEXT NOT NULL,
    size INTEGER NOT NULL,
    bbox TEXT NOT NULL,
    files TEXT NOT NULL,
    downloaded_at INTEGER NOT NULL
  );
  `,
];

export function migrate() {
  db.execSync("PRAGMA journal_mode = WAL");
  const row = db.getFirstSync<{ user_version: number }>("PRAGMA user_version");
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    db.withTransactionSync(() => {
      db.execSync(MIGRATIONS[version]);
    });
    version++;
    db.execSync(`PRAGMA user_version = ${version}`);
  }
}
