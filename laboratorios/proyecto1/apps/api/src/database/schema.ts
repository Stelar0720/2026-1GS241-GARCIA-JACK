// Sinnoh Edition - Database Schema
// Defines all database tables for the application

import { getCacheCreateSQL } from '../../../../packages/pokemon-cache/src/cache-schema.js';

export const SCHEMA_SQL = `
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

  -- Battle logs for persistence
  CREATE TABLE IF NOT EXISTS battle_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    turn_number INTEGER,
    actor_id TEXT,
    action TEXT,
    source_pokemon INTEGER,
    target_pokemon INTEGER,
    move_name TEXT,
    damage_dealt INTEGER,
    log_message TEXT,
    timestamp INTEGER,
    FOREIGN KEY (room_id) REFERENCES rooms(id)
  );
`;

export const INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_players_room ON players(room_id);
  CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);
  CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
  CREATE INDEX IF NOT EXISTS idx_bans_room ON room_bans(room_id);
  CREATE INDEX IF NOT EXISTS idx_bans_player ON room_bans(player_id);
  CREATE INDEX IF NOT EXISTS idx_teams_room ON teams(room_id);
  CREATE INDEX IF NOT EXISTS idx_teams_player ON teams(player_id);
`;

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

export interface BanRow {
  id: number;
  room_id: string;
  player_id: string;
  pokemon_id: string;
  created_at: number;
}

export interface TeamRow {
  id: number;
  room_id: string;
  player_id: string;
  pokemon_data: string;
  created_at: number;
}

export interface BattleLogRow {
  id: number;
  room_id: string;
  turn_number: number;
  actor_id: string;
  action: string;
  source_pokemon: number;
  target_pokemon: number;
  move_name: string | null;
  damage_dealt: number | null;
  log_message: string;
  timestamp: number;
}

export default { SCHEMA_SQL, INDEX_SQL };
