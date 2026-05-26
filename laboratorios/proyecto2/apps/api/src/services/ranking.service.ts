// Ranking service usando sql.js
import { runQuery, selectQuery } from '../db/schema';
import type { RankingEntry, Difficulty, GameMode } from '@checkers/shared';

interface CreateRankingInput {
  username: string;
  moves: number;
  difficulty: Difficulty;
  gameMode: GameMode;
  deviceHash?: string;
  clerkId?: string;
}

// Crear nuevo ranking
export function createRanking(input: CreateRankingInput): RankingEntry {
  const now = Date.now();
  runQuery(
    `INSERT INTO rankings (username, moves, difficulty, game_mode, created_at, device_hash, clerk_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [input.username, input.moves, input.difficulty, input.gameMode, now, input.deviceHash || null, input.clerkId || null]
  );

  const results = selectQuery(
    `SELECT * FROM rankings WHERE id = (SELECT last_insert_rowid())`
  );

  const r = results[0];
  return {
    id: r.id,
    username: r.username,
    moves: r.moves,
    difficulty: r.difficulty as Difficulty,
    gameMode: r.game_mode as GameMode,
    createdAt: new Date(r.created_at),
    deviceHash: r.device_hash,
    clerkId: r.clerk_id
  };
}

// Obtener top rankings
export function getTopRankings(limit: number = 10, filters?: { difficulty?: Difficulty; gameMode?: GameMode }): RankingEntry[] {
  let sql = `SELECT * FROM rankings WHERE 1=1`;
  const params: any[] = [];

  if (filters?.difficulty) {
    sql += ` AND difficulty = ?`;
    params.push(filters.difficulty);
  }
  if (filters?.gameMode) {
    sql += ` AND game_mode = ?`;
    params.push(filters.gameMode);
  }

  sql += ` ORDER BY moves ASC LIMIT ?`;
  params.push(limit);

  const results = selectQuery(sql, params);

  return results.map(r => ({
    id: r.id,
    username: r.username,
    moves: r.moves,
    difficulty: r.difficulty as Difficulty,
    gameMode: r.game_mode as GameMode,
    createdAt: new Date(r.created_at),
    deviceHash: r.device_hash,
    clerkId: r.clerk_id
  }));
}

// Obtener rankings de usuario
export function getUserRankings(username: string): RankingEntry[] {
  const results = selectQuery(
    `SELECT * FROM rankings WHERE username = ? ORDER BY moves ASC`,
    [username]
  );

  return results.map(r => ({
    id: r.id,
    username: r.username,
    moves: r.moves,
    difficulty: r.difficulty as Difficulty,
    gameMode: r.game_mode as GameMode,
    createdAt: new Date(r.created_at),
    deviceHash: r.device_hash,
    clerkId: r.clerk_id
  }));
}

// Obtener rankings por Clerk ID
export function getClerkRankings(clerkId: string): RankingEntry[] {
  const results = selectQuery(
    `SELECT * FROM rankings WHERE clerk_id = ? ORDER BY moves ASC LIMIT 20`,
    [clerkId]
  );

  return results.map(r => ({
    id: r.id,
    username: r.username,
    moves: r.moves,
    difficulty: r.difficulty as Difficulty,
    gameMode: r.game_mode as GameMode,
    createdAt: new Date(r.created_at),
    deviceHash: r.device_hash,
    clerkId: r.clerk_id
  }));
}
