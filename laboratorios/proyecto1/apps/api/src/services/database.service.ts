// Sinnoh Edition - SQLite Database Service
import { Database } from 'bun:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '../../data/sinnoh.db');

// Ensure data directory exists
const dataDir = join(__dirname, '../../data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.exec('PRAGMA journal_mode = WAL');

// Add new columns if they don't exist (for existing databases)
try {
  db.exec('ALTER TABLE rooms ADD COLUMN current_ban_turn TEXT');
} catch { /* Column may already exist */ }
try {
  db.exec('ALTER TABLE rooms ADD COLUMN ban_phase_start_time INTEGER');
} catch { /* Column may already exist */ }

// Initialize tables
db.exec(`
  -- Players table
  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    gender TEXT DEFAULT 'male',
    sprite_url TEXT,
    connected INTEGER DEFAULT 0,
    room_id TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  );

  -- Rooms table
  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'waiting',
    host_player_id TEXT,
    player1_id TEXT,
    player2_id TEXT,
    player1_ready INTEGER DEFAULT 0,
    player2_ready INTEGER DEFAULT 0,
    current_turn TEXT,
    current_ban_turn TEXT,
    ban_phase_start_time INTEGER,
    winner TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
  );

  -- Banned Pokemon table
  CREATE TABLE IF NOT EXISTS room_bans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    pokemon_id TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (room_id) REFERENCES rooms(id)
  );

  -- Teams table (JSON storage for flexibility)
  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    pokemon_data TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (room_id) REFERENCES rooms(id)
  );
`);

export interface PlayerRow {
  id: string;
  name: string;
  gender: string;
  sprite_url: string | null;
  connected: number;
  room_id: string | null;
  created_at: number;
}

export interface RoomRow {
  id: string;
  code: string;
  status: string;
  host_player_id: string | null;
  player1_id: string | null;
  player2_id: string | null;
  player1_ready: number;
  player2_ready: number;
  current_turn: string | null;
  current_ban_turn: string | null;
  ban_phase_start_time: number | null;
  winner: string | null;
  created_at: number;
  updated_at: number;
}

export interface TeamRow {
  id: number;
  room_id: string;
  player_id: string;
  pokemon_data: string;
  created_at: number;
}

export interface BanRow {
  pokemon_id: string;
  player_id: string;
}

// Player operations
export const playerOps = {
  create: db.prepare(`
    INSERT INTO players (id, name, gender, sprite_url)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      gender = excluded.gender,
      sprite_url = excluded.sprite_url
  `),

  findById: db.prepare(`
    SELECT * FROM players WHERE id = ?
  `),

  updateConnection: db.prepare(`
    UPDATE players SET connected = ?, room_id = ? WHERE id = ?
  `),

  findByRoom: db.prepare(`
    SELECT * FROM players WHERE room_id = ?
  `),
};

// Room operations
export const roomOps = {
  create: db.prepare(`
    INSERT INTO rooms (id, code, status, host_player_id, player1_id)
    VALUES (?, ?, 'waiting', ?, ?)
  `),

  findById: db.prepare(`
    SELECT * FROM rooms WHERE id = ?
  `),

  findByCode: db.prepare(`
    SELECT * FROM rooms WHERE code = ?
  `),

  updateStatus: db.prepare(`
    UPDATE rooms SET status = ?, updated_at = strftime('%s', 'now') WHERE id = ?
  `),

  updatePlayer1: db.prepare(`
    UPDATE rooms SET
      player1_id = ?,
      player1_ready = CASE WHEN ? IS NULL THEN 0 ELSE player1_ready END,
      updated_at = strftime('%s', 'now')
    WHERE id = ?
  `),

  updatePlayer2: db.prepare(`
    UPDATE rooms SET
      player2_id = ?,
      player2_ready = CASE WHEN ? IS NULL THEN 0 ELSE player2_ready END,
      updated_at = strftime('%s', 'now')
    WHERE id = ?
  `),

  setPlayerReady: db.prepare(`
    UPDATE rooms SET 
      player1_ready = CASE WHEN player1_id = ? THEN 1 ELSE player1_ready END,
      player2_ready = CASE WHEN player2_id = ? THEN 1 ELSE player2_ready END,
      updated_at = strftime('%s', 'now')
    WHERE id = ?
  `),

  setCurrentTurn: db.prepare(`
    UPDATE rooms SET current_turn = ?, updated_at = strftime('%s', 'now') WHERE id = ?
  `),

  setCurrentBanTurn: db.prepare(`
    UPDATE rooms SET current_ban_turn = ?, updated_at = strftime('%s', 'now') WHERE id = ?
  `),

  setBanPhaseStartTime: db.prepare(`
    UPDATE rooms SET ban_phase_start_time = ?, updated_at = strftime('%s', 'now') WHERE id = ?
  `),

  setWinner: db.prepare(`
    UPDATE rooms SET winner = ?, status = 'finished', updated_at = strftime('%s', 'now') WHERE id = ?
  `),

  updateTimestamp: db.prepare(`
    UPDATE rooms SET updated_at = strftime('%s', 'now') WHERE id = ?
  `),

  deleteOld: db.prepare(`
    DELETE FROM rooms WHERE updated_at < strftime('%s', 'now') - 3600
  `),
};

// Ban operations
export const banOps = {
  add: db.prepare(`
    INSERT INTO room_bans (room_id, player_id, pokemon_id)
    VALUES (?, ?, ?)
  `),

  findByRoom: db.prepare(`
    SELECT pokemon_id, player_id FROM room_bans WHERE room_id = ?
  `),

  deleteByRoom: db.prepare(`
    DELETE FROM room_bans WHERE room_id = ?
  `),
};

// Team operations
export const teamOps = {
  save: db.prepare(`
    INSERT OR REPLACE INTO teams (room_id, player_id, pokemon_data)
    VALUES (?, ?, ?)
  `),

  findByRoomAndPlayer: db.prepare(`
    SELECT * FROM teams WHERE room_id = ? AND player_id = ?
  `),
};

// Helper to generate unique room code
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  // Ensure uniqueness
  const existing = roomOps.findByCode.get(code);
  if (existing) {
    return generateRoomCode();
  }
  
  return code;
}

export default db;