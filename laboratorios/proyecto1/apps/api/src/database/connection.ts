// Sinnoh Edition - Database Connection
// SQLite connection manager with connection pooling

import { Database } from 'bun:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCHEMA_SQL, INDEX_SQL } from './schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Data directory path
const dataDir = join(__dirname, '../../data');
const dbPath = join(dataDir, 'sinnoh.db');

// Ensure data directory exists
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// Create database instance
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.exec('PRAGMA journal_mode = WAL');

// Initialize schema
db.exec(SCHEMA_SQL);
db.exec(INDEX_SQL);

export interface DatabaseStats {
  players: number;
  rooms: number;
  teams: number;
}

/**
 * Get database statistics
 */
export function getDatabaseStats(): DatabaseStats {
  const players = db.query('SELECT COUNT(*) as count FROM players').get() as { count: number };
  const rooms = db.query('SELECT COUNT(*) as count FROM rooms').get() as { count: number };
  const teams = db.query('SELECT COUNT(*) as count FROM teams').get() as { count: number };

  return {
    players: players.count,
    rooms: rooms.count,
    teams: teams.count,
  };
}

/**
 * Clean up old rooms and data
 */
export function cleanupOldData(): number {
  // Delete rooms older than 1 hour
  const result = db.run(`
    DELETE FROM rooms 
    WHERE updated_at < strftime('%s', 'now') - 3600
    AND status IN ('waiting', 'finished')
  `);
  
  return result.changes;
}

/**
 * Get database path
 */
export function getDatabasePath(): string {
  return dbPath;
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  db.close();
}

export default db;
