// Sinnoh Edition - Room Service
// Handles room creation, management, and room-related operations

import db, { Database } from '../database/connection.js';
import type { RoomRow, PlayerRow } from '../database/schema.js';

export interface RoomService {
  createRoom: (hostPlayerId: string) => { roomId: string; code: string };
  findRoomById: (roomId: string) => RoomRow | null;
  findRoomByCode: (code: string) => RoomRow | null;
  joinRoom: (roomId: string, playerId: string) => boolean;
  leaveRoom: (roomId: string, playerId: string) => void;
  updateRoomStatus: (roomId: string, status: string) => void;
  setPlayerReady: (roomId: string, playerId: string) => void;
  addBan: (roomId: string, playerId: string, pokemonId: string) => void;
  getBans: (roomId: string) => string[];
  saveTeam: (roomId: string, playerId: string, teamData: any[]) => void;
  getTeam: (roomId: string, playerId: string) => any[] | null;
  cleanupOldRooms: () => number;
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Prepared statements
const statements = {
  // Player operations
  createPlayer: db.prepare(`
    INSERT INTO players (id, name, gender, sprite_url)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      gender = excluded.gender,
      sprite_url = excluded.sprite_url
  `),

  findPlayerById: db.prepare(`
    SELECT * FROM players WHERE id = ?
  `),

  updatePlayerConnection: db.prepare(`
    UPDATE players SET connected = ?, room_id = ? WHERE id = ?
  `),

  // Room operations
  createRoom: db.prepare(`
    INSERT INTO rooms (id, code, status, host_player_id, player1_id)
    VALUES (?, ?, 'waiting', ?, ?)
  `),

  findRoomById: db.prepare(`
    SELECT * FROM rooms WHERE id = ?
  `),

  findRoomByCode: db.prepare(`
    SELECT * FROM rooms WHERE code = ?
  `),

  updateRoomStatus: db.prepare(`
    UPDATE rooms SET status = ?, updated_at = strftime('%s', 'now') WHERE id = ?
  `),

  updatePlayer1: db.prepare(`
    UPDATE rooms SET player1_id = ?, updated_at = strftime('%s', 'now') WHERE id = ?
  `),

  updatePlayer2: db.prepare(`
    UPDATE rooms SET player2_id = ?, updated_at = strftime('%s', 'now') WHERE id = ?
  `),

  setPlayer1Ready: db.prepare(`
    UPDATE rooms SET player1_ready = 1, updated_at = strftime('%s', 'now') WHERE id = ? AND player1_id = ?
  `),

  setPlayer2Ready: db.prepare(`
    UPDATE rooms SET player2_ready = 1, updated_at = strftime('%s', 'now') WHERE id = ? AND player2_id = ?
  `),

  setCurrentTurn: db.prepare(`
    UPDATE rooms SET current_turn = ? WHERE id = ?
  `),

  setWinner: db.prepare(`
    UPDATE rooms SET winner = ?, status = 'finished', updated_at = strftime('%s', 'now') WHERE id = ?
  `),

  // Ban operations
  addBan: db.prepare(`
    INSERT INTO room_bans (room_id, player_id, pokemon_id)
    VALUES (?, ?, ?)
  `),

  findBansByRoom: db.prepare(`
    SELECT pokemon_id FROM room_bans WHERE room_id = ?
  `),

  // Team operations
  saveTeam: db.prepare(`
    INSERT OR REPLACE INTO teams (room_id, player_id, pokemon_data)
    VALUES (?, ?, ?)
  `),

  findTeamByRoomAndPlayer: db.prepare(`
    SELECT * FROM teams WHERE room_id = ? AND player_id = ?
  `),

  // Cleanup
  deleteOldRooms: db.prepare(`
    DELETE FROM rooms WHERE updated_at < strftime('%s', 'now') - 3600
    AND status IN ('waiting', 'finished')
  `),
};

export const roomService = {
  /**
   * Create a new room
   */
  createRoom(hostPlayerId: string): { roomId: string; code: string } {
    const roomId = crypto.randomUUID();
    let code = generateRoomCode();
    
    // Ensure unique code
    while (statements.findRoomByCode.get(code)) {
      code = generateRoomCode();
    }

    statements.createRoom.run(roomId, code, hostPlayerId, hostPlayerId);
    
    return { roomId, code };
  },

  /**
   * Find room by ID
   */
  findRoomById(roomId: string): RoomRow | null {
    return statements.findRoomById.get(roomId) as RoomRow | null;
  },

  /**
   * Find room by code
   */
  findRoomByCode(code: string): RoomRow | null {
    return statements.findRoomByCode.get(code) as RoomRow | null;
  },

  /**
   * Join a room as player 2
   */
  joinRoom(roomId: string, player2Id: string): boolean {
    const room = this.findRoomById(roomId);
    if (!room) return false;
    
    if (room.player1_id && !room.player2_id) {
      statements.updatePlayer2.run(player2Id, roomId);
      statements.updatePlayerConnection.run(1, roomId, player2Id);
      return true;
    }
    
    return false;
  },

  /**
   * Leave a room
   */
  leaveRoom(roomId: string, playerId: string): void {
    const room = this.findRoomById(roomId);
    if (!room) return;

    if (room.player1_id === playerId) {
      statements.updatePlayer1.run(null, roomId);
    } else if (room.player2_id === playerId) {
      statements.updatePlayer2.run(null, roomId);
    }

    statements.updatePlayerConnection.run(0, null, playerId);
  },

  /**
   * Update room status
   */
  updateRoomStatus(roomId: string, status: string): void {
    statements.updateRoomStatus.run(status, roomId);
  },

  /**
   * Set player as ready
   */
  setPlayerReady(roomId: string, playerId: string): void {
    const room = this.findRoomById(roomId);
    if (!room) return;

    if (room.player1_id === playerId) {
      statements.setPlayer1Ready.run(roomId, playerId);
    } else if (room.player2_id === playerId) {
      statements.setPlayer2Ready.run(roomId, playerId);
    }
  },

  /**
   * Check if both players are ready
   */
  areBothReady(roomId: string): boolean {
    const room = this.findRoomById(roomId);
    return room ? room.player1_ready === 1 && room.player2_ready === 1 : false;
  },

  /**
   * Add a ban
   */
  addBan(roomId: string, playerId: string, pokemonId: string): void {
    statements.addBan.run(roomId, playerId, pokemonId);
  },

  /**
   * Get all bans for a room
   */
  getBans(roomId: string): string[] {
    const bans = statements.findBansByRoom.all(roomId) as { pokemon_id: string }[];
    return bans.map(b => b.pokemon_id);
  },

  /**
   * Save team
   */
  saveTeam(roomId: string, playerId: string, teamData: any[]): void {
    statements.saveTeam.run(roomId, playerId, JSON.stringify(teamData));
  },

  /**
   * Get team
   */
  getTeam(roomId: string, playerId: string): any[] | null {
    const team = statements.findTeamByRoomAndPlayer.get(roomId, playerId) as { pokemon_data: string } | null;
    if (!team) return null;
    try {
      return JSON.parse(team.pokemon_data);
    } catch {
      return null;
    }
  },

  /**
   * Set current turn
   */
  setCurrentTurn(roomId: string, playerId: string): void {
    statements.setCurrentTurn.run(playerId, roomId);
  },

  /**
   * Set winner
   */
  setWinner(roomId: string, winnerId: string): void {
    statements.setWinner.run(winnerId, roomId);
  },

  /**
   * Cleanup old rooms
   */
  cleanupOldRooms(): number {
    const result = statements.deleteOldRooms.run();
    return result.changes;
  },
};

export default roomService;
