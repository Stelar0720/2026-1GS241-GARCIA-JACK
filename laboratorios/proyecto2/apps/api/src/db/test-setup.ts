import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { rankings, gameSessions, heartbeats } from './schema';

// Base de datos en memoria para testing
const sqlite = new Database(':memory:');

// Crear tablas de prueba
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS rankings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    moves INTEGER NOT NULL,
    difficulty TEXT NOT NULL,
    game_mode TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    device_hash TEXT
  );

  CREATE TABLE IF NOT EXISTS game_sessions (
    id TEXT PRIMARY KEY,
    board TEXT NOT NULL,
    current_player TEXT NOT NULL,
    move_count INTEGER DEFAULT 0,
    status TEXT NOT NULL,
    difficulty TEXT,
    game_mode TEXT NOT NULL,
    winner TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
  );

  CREATE TABLE IF NOT EXISTS heartbeats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_name TEXT NOT NULL,
    status TEXT NOT NULL,
    timestamp INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    metadata TEXT
  );
`);

export const testDb = drizzle(sqlite);

export { rankings, gameSessions, heartbeats };
