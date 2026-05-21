// Sinnoh Edition - WebSocket Server with Ban Phase Timer
import { WebSocketServer, WebSocket, RawData } from 'ws';
import { roomOps, playerOps, banOps, teamOps, generateRoomCode } from './database.service.js';
import type { BanRow, RoomRow, TeamRow } from './database.service.js';

interface Client {
  ws: WebSocket;
  playerId: string;
  roomId: string | null;
}

interface Message {
  type: string;
  payload: any;
}

// Constants
const BAN_PHASE_TIMEOUT = 60; // seconds
const BANS_PER_PLAYER = 6;

// Track ban phase timers per room
const banTimers = new Map<string, NodeJS.Timeout>();
const banTimeRemaining = new Map<string, number>();
const banDecisionCounts = new Map<string, number>();
const coinCallPlayers = new Map<string, string>();

// Broadcast to all clients in a room
function broadcastToRoom(roomId: string, message: Message, excludePlayerId?: string) {
  const roomClients = rooms.get(roomId);
  if (!roomClients) return;

  const msgStr = JSON.stringify(message);
  
  for (const playerId of roomClients) {
    if (playerId === excludePlayerId) continue;
    
    const client = clients.get(playerId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(msgStr);
    }
  }
}

// Send to specific player
function sendToPlayer(playerId: string, message: Message) {
  const client = clients.get(playerId);
  if (client && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(message));
  }
}

// Clear ban timer for a room
function clearBanTimer(roomId: string) {
  const timer = banTimers.get(roomId);
  if (timer) {
    clearInterval(timer);
    banTimers.delete(roomId);
  }
  banTimeRemaining.delete(roomId);
}

function getBanDecisionCount(roomId: string): number {
  const persistedBans = (banOps.findByRoom.all(roomId) as BanRow[]).length;
  return Math.max(persistedBans, banDecisionCounts.get(roomId) || 0);
}

function advanceToTeamSelect(roomId: string) {
  clearBanTimer(roomId);
  banDecisionCounts.delete(roomId);
  roomOps.updateStatus.run('team_select', roomId);

  const allBans = banOps.findByRoom.all(roomId) as BanRow[];
  broadcastToRoom(roomId, {
    type: 'phase_change',
    payload: {
      phase: 'team_select',
      roomId,
      bans: allBans.map((b: BanRow) => b.pokemon_id)
    }
  });
}

function parseTeam(row: unknown): any[] {
  if (!row) return [];
  try {
    return JSON.parse((row as TeamRow).pokemon_data);
  } catch {
    return [];
  }
}

function getPublicPlayer(playerId: string | null | undefined) {
  if (!playerId) return null;
  const row = playerOps.findById.get(playerId) as any;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    gender: row.gender || 'other',
    spriteUrl: row.sprite_url || '',
  };
}

function randomCoinSide(): 'red' | 'charizard' {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] % 2 === 0 ? 'red' : 'charizard';
}

// Start ban phase timer
function startBanTimer(roomId: string) {
  // Clear any existing timer
  clearBanTimer(roomId);
  
  // Initialize time remaining
  banTimeRemaining.set(roomId, BAN_PHASE_TIMEOUT);
  banDecisionCounts.set(roomId, getBanDecisionCount(roomId));
  
  // Send initial time to both players
  broadcastToRoom(roomId, {
    type: 'ban_timer',
    payload: { timeRemaining: BAN_PHASE_TIMEOUT, isMyTurn: true }
  });
  
  // Update timer every second
  const timer = setInterval(() => {
    const currentTurn = getCurrentBanTurn(roomId);
    const timeLeft = (banTimeRemaining.get(roomId) || 0) - 1;
    banTimeRemaining.set(roomId, timeLeft);
    
    // Send time update to both players
    broadcastToRoom(roomId, {
      type: 'ban_timer_update',
      payload: { timeRemaining: timeLeft, currentTurn }
    });
    
    // Check if time expired
    if (timeLeft <= 0) {
      handleBanTimeout(roomId, currentTurn);
    }
  }, 1000);
  
  banTimers.set(roomId, timer);
}

// Handle ban timeout - skip current player's turn
function handleBanTimeout(roomId: string, currentPlayerId: string | null) {
  if (!currentPlayerId) return;
  
  const room = roomOps.findById.get(roomId) as RoomRow | undefined;
  if (!room || room.status !== 'ban_phase') return;
  
  console.log(`⏱️ Ban timeout for player ${currentPlayerId} in room ${roomId}`);

  const decisions = getBanDecisionCount(roomId) + 1;
  banDecisionCounts.set(roomId, decisions);

  if (decisions >= BANS_PER_PLAYER * 2) {
    advanceToTeamSelect(roomId);
    return;
  }
  
  // Skip this player's turn - mark as skipped
  const nextPlayer = getNextBanTurnPlayer(room, currentPlayerId);
  
  // Update current ban turn
  roomOps.setCurrentBanTurn.run(nextPlayer, roomId);
  
  // Reset timer for next player
  banTimeRemaining.set(roomId, BAN_PHASE_TIMEOUT);
  
  // Notify players
  broadcastToRoom(roomId, {
    type: 'ban_skipped',
    payload: { 
      playerId: currentPlayerId, 
      reason: 'timeout',
      nextTurn: nextPlayer,
      timeRemaining: BAN_PHASE_TIMEOUT
    }
  });
  
  // Start new timer for next player
  startBanTimerForPlayer(roomId, nextPlayer);
}

// Start timer for specific player
function startBanTimerForPlayer(roomId: string, playerId: string) {
  clearBanTimer(roomId);
  banTimeRemaining.set(roomId, BAN_PHASE_TIMEOUT);
  
  const timer = setInterval(() => {
    const timeLeft = (banTimeRemaining.get(roomId) || 0) - 1;
    banTimeRemaining.set(roomId, timeLeft);
    
    const room = roomOps.findById.get(roomId) as RoomRow | undefined;
    
    broadcastToRoom(roomId, {
      type: 'ban_timer_update',
      payload: { 
        timeRemaining: timeLeft, 
        currentTurn: playerId,
        isMyTurn: true 
      }
    });
    
    if (timeLeft <= 0) {
      handleBanTimeout(roomId, playerId);
    }
  }, 1000);
  
  banTimers.set(roomId, timer);
}

// Get current ban turn from room
function getCurrentBanTurn(roomId: string): string | null {
  const room = roomOps.findById.get(roomId) as RoomRow | undefined;
  return room?.current_ban_turn || null;
}

// Get next player to ban
function getNextBanTurnPlayer(room: RoomRow, currentPlayerId: string): string {
  // Simple alternation: if current is player1, next is player2, and vice versa
  return room.player1_id === currentPlayerId ? (room.player2_id || '') : (room.player1_id || '');
}

// Determine who bans first (player1 always bans first in our implementation)
function getFirstBanPlayer(room: RoomRow): string {
  return room.player1_id || '';
}

// Initialize clients map
const clients = new Map<string, Client>();
const rooms = new Map<string, Set<string>>(); // roomId -> Set<playerId>

export function setupWebSocketServer(port: number = 3001) {
  const wss = new WebSocketServer({ port });

  console.log(`🔌 WebSocket server running on ws://localhost:${port}`);

  wss.on('connection', (ws: WebSocket) => {
    let playerId: string | null = null;

    ws.on('message', (data: RawData) => {
      try {
        const message: Message = JSON.parse(data.toString());
        handleMessage(ws, message, (id) => { playerId = id; });
      } catch (e) {
        console.error('Invalid WebSocket message:', e);
      }
    });

    ws.on('close', () => {
      if (playerId) {
        handleDisconnect(playerId);
      }
    });

    ws.on('error', (err: Error) => {
      console.error('WebSocket error:', err);
    });
  });

  function handleMessage(ws: WebSocket, message: Message, setPlayerId: (id: string) => void) {
    const { type, payload } = message;

    switch (type) {
      case 'register':
        handleRegister(ws, payload, setPlayerId);
        break;
      
      case 'create_room':
        handleCreateRoom(ws, payload);
        break;
      
      case 'join_room':
        handleJoinRoom(ws, payload);
        break;
      
      case 'leave_room':
        handleLeaveRoom(ws, payload);
        break;
      
      case 'ready':
        handleReady(ws, payload);
        break;
      
      case 'ban_pokemon':
        handleBanPokemon(ws, payload);
        break;
      
      case 'select_team':
        handleSelectTeam(ws, payload);
        break;

      case 'call_coin':
        handleCallCoin(ws, payload);
        break;
      
      case 'battle_action':
        handleBattleAction(ws, payload);
        break;
      
      case 'switch_pokemon':
        handleSwitchPokemon(ws, payload);
        break;
      
      case 'ping':
        sendToPlayer(payload.playerId, { type: 'pong', payload: { timestamp: Date.now() } });
        break;
    }
  }

  function handleRegister(ws: WebSocket, payload: any, setPlayerId: (id: string) => void) {
    const { playerId, name, gender, spriteUrl } = payload;
    
    // Save or update player
    playerOps.create.run(playerId, name, gender, spriteUrl);
    playerOps.updateConnection.run(1, null, playerId);

    // Store client
    clients.set(playerId, { ws, playerId, roomId: null });
    setPlayerId(playerId);

    console.log(`📝 Player registered: ${name} (${playerId})`);
    
    sendToPlayer(playerId, { 
      type: 'registered', 
      payload: { success: true, playerId } 
    });
  }

  function handleCreateRoom(ws: WebSocket, payload: any) {
    const { playerId } = payload;
    const client = clients.get(playerId);
    if (!client) return;

    // Create room in DB
    const roomId = crypto.randomUUID();
    const code = generateRoomCode();
    
    roomOps.create.run(roomId, code, playerId, playerId);
    playerOps.updateConnection.run(1, roomId, playerId);

    // Update client
    client.roomId = roomId;
    
    // Track room
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId)!.add(playerId);

    console.log(`🏠 Room created: ${code} by ${playerId}`);

    sendToPlayer(playerId, {
      type: 'room_created',
      payload: { roomId, code, status: 'waiting' }
    });
  }

  function handleJoinRoom(ws: WebSocket, payload: any) {
    const { playerId, code } = payload;
    const client = clients.get(playerId);
    if (!client) return;

    const room = roomOps.findByCode.get(code) as RoomRow | undefined;
    if (!room) {
      sendToPlayer(playerId, { type: 'error', payload: { message: 'Room not found' } });
      return;
    }

    if (room.player1_id && room.player2_id) {
      sendToPlayer(playerId, { type: 'error', payload: { message: 'Room is full' } });
      return;
    }

    // Join as player 2
    roomOps.updatePlayer2.run(playerId, playerId, room.id);
    playerOps.updateConnection.run(1, room.id, playerId);

    // Update client
    client.roomId = room.id;
    
    // Track room
    if (!rooms.has(room.id)) {
      rooms.set(room.id, new Set());
    }
    rooms.get(room.id)!.add(playerId);

    console.log(`👤 ${playerId} joined room ${code}`);

    // Notify both players
    sendToPlayer(playerId, {
      type: 'room_joined',
      payload: {
        roomId: room.id,
        code,
        status: 'waiting',
        player1Id: room.player1_id,
        opponent: getPublicPlayer(room.player1_id),
      }
    });

    if (room.player1_id) {
      sendToPlayer(room.player1_id, {
        type: 'opponent_joined',
        payload: { roomId: room.id, opponentId: playerId, opponent: getPublicPlayer(playerId) }
      });
    }
  }

  function handleLeaveRoom(ws: WebSocket, payload: any) {
    const { playerId } = payload;
    const client = clients.get(playerId);
    if (!client || !client.roomId) return;

    leaveRoom(playerId, client.roomId);
  }

  function leaveRoom(playerId: string, roomId: string) {
    const client = clients.get(playerId);
    if (!client) return;

    // Clear ban timer if exists
    clearBanTimer(roomId);

    const room = roomOps.findById.get(roomId) as RoomRow | undefined;
    if (room) {
      // Notify other player
      const otherPlayerId = room.player1_id === playerId ? room.player2_id : room.player1_id;
      
      if (otherPlayerId) {
        sendToPlayer(otherPlayerId, {
          type: 'opponent_left',
          payload: { message: 'Opponent left the room' }
        });
      }

      // Clean up room
      if (room.player1_id === playerId) {
        roomOps.updatePlayer1.run(null, null, roomId);
      } else {
        roomOps.updatePlayer2.run(null, null, roomId);
      }
    }

    // Update player
    playerOps.updateConnection.run(0, null, playerId);
    client.roomId = null;

    // Remove from room tracking
    const roomClients = rooms.get(roomId);
    if (roomClients) {
      roomClients.delete(playerId);
      if (roomClients.size === 0) {
        rooms.delete(roomId);
        // Clean up DB
        banOps.deleteByRoom.run(roomId);
      }
    }

    console.log(`👋 ${playerId} left room ${roomId}`);
  }

  function handleReady(ws: WebSocket, payload: any) {
    const { playerId } = payload;
    const client = clients.get(playerId);
    if (!client || !client.roomId) return;

    const room = roomOps.findById.get(client.roomId) as RoomRow | undefined;
    if (!room) return;

    roomOps.setPlayerReady.run(playerId, playerId, client.roomId);

    // Broadcast to room
    broadcastToRoom(client.roomId, {
      type: 'player_ready',
      payload: { playerId, roomId: client.roomId }
    });

    // Check if both ready
    const updatedRoom = roomOps.findById.get(client.roomId) as RoomRow | undefined;
    if (updatedRoom && updatedRoom.player1_ready && updatedRoom.player2_ready) {
      // Start ban phase
      roomOps.updateStatus.run('ban_phase', client.roomId);
      
      // Set first ban turn to player1
      const firstBanPlayer = updatedRoom.player1_id || '';
      const now = Math.floor(Date.now() / 1000);
      
      roomOps.setCurrentBanTurn.run(firstBanPlayer, client.roomId);
      roomOps.setBanPhaseStartTime.run(now, client.roomId);
      
      // Start ban timer
      startBanTimer(client.roomId);
      
      broadcastToRoom(client.roomId, {
        type: 'phase_change',
        payload: { 
          phase: 'ban_phase', 
          roomId: client.roomId,
          currentBanTurn: firstBanPlayer,
          banPhaseStartTime: now,
          timeRemaining: BAN_PHASE_TIMEOUT
        }
      });
    }
  }

  function handleBanPokemon(ws: WebSocket, payload: any) {
    const { playerId, pokemonId } = payload;
    const client = clients.get(playerId);
    if (!client || !client.roomId) return;

    const room = roomOps.findById.get(client.roomId) as RoomRow | undefined;
    if (!room || room.status !== 'ban_phase') return;

    // Check if it's this player's turn
    if (room.current_ban_turn && room.current_ban_turn !== playerId) {
      sendToPlayer(playerId, { 
        type: 'error', 
        payload: { message: 'Not your turn to ban' } 
      });
      return;
    }

    // Check ban limit (3 per player)
    const bans = banOps.findByRoom.all(client.roomId) as BanRow[];
    const playerBans = bans.filter((b: BanRow) => b.player_id === playerId);
    const alreadyBanned = bans.some((b: BanRow) => b.pokemon_id === pokemonId);
    
    if (playerBans.length >= BANS_PER_PLAYER) {
      sendToPlayer(playerId, { type: 'error', payload: { message: 'Ban limit reached' } });
      return;
    }

    if (alreadyBanned) {
      sendToPlayer(playerId, { type: 'error', payload: { message: 'Pokemon already banned' } });
      return;
    }

    // Add ban
    const decisionsBeforeBan = getBanDecisionCount(client.roomId);
    banOps.add.run(client.roomId, playerId, pokemonId);

    // Get updated bans count
    const allBans = banOps.findByRoom.all(client.roomId) as BanRow[];
    banDecisionCounts.set(client.roomId, decisionsBeforeBan + 1);
    
    // Broadcast to both players
    broadcastToRoom(client.roomId, {
      type: 'pokemon_banned',
      payload: { 
        playerId, 
        pokemonId, 
        roomId: client.roomId,
        totalBans: allBans.length,
        isMyBan: true
      }
    });

    // Check if all bans complete
    if (getBanDecisionCount(client.roomId) >= BANS_PER_PLAYER * 2) {
      advanceToTeamSelect(client.roomId);
    } else {
      // Switch turn to other player
      const nextPlayer = getNextBanTurnPlayer(room, playerId);
      roomOps.setCurrentBanTurn.run(nextPlayer, client.roomId);
      
      // Reset timer for next player
      startBanTimerForPlayer(client.roomId, nextPlayer);
      
      // Notify of turn change
      broadcastToRoom(client.roomId, {
        type: 'ban_turn_changed',
        payload: { 
          currentTurn: nextPlayer,
          player1Bans: allBans.filter((b: BanRow) => b.player_id === room.player1_id).length,
          player2Bans: allBans.filter((b: BanRow) => b.player_id === room.player2_id).length
        }
      });
    }
  }

  function handleSelectTeam(ws: WebSocket, payload: any) {
    const { playerId, team } = payload;
    const client = clients.get(playerId);
    if (!client || !client.roomId) return;

    // Save team
    teamOps.deleteByRoomAndPlayer.run(client.roomId, playerId);
    teamOps.save.run(client.roomId, playerId, JSON.stringify(team));

    // Broadcast team selected
    broadcastToRoom(client.roomId, {
      type: 'team_selected',
      payload: { playerId, roomId: client.roomId, team }
    });

    // Check if both teams selected
    const updatedRoom = roomOps.findById.get(client.roomId) as RoomRow | undefined;
    
    if (updatedRoom) {
      const p1Team = teamOps.findByRoomAndPlayer.get(client.roomId, updatedRoom.player1_id);
      const p2Team = teamOps.findByRoomAndPlayer.get(client.roomId, updatedRoom.player2_id);

      if (p1Team && p2Team) {
        roomOps.updateStatus.run('pre_battle', client.roomId);
        const chooserPlayerId = updatedRoom.player1_id || '';
        coinCallPlayers.set(client.roomId, chooserPlayerId);
        
        broadcastToRoom(client.roomId, {
          type: 'phase_change',
          payload: {
            phase: 'pre_battle',
            roomId: client.roomId,
            player1Id: updatedRoom.player1_id,
            player2Id: updatedRoom.player2_id,
            player1Team: parseTeam(p1Team),
            player2Team: parseTeam(p2Team),
            currentTurn: null,
            coinFlip: {
              status: 'choosing',
              chooserPlayerId,
            }
          }
        });
      }
    }
  }

  function handleCallCoin(ws: WebSocket, payload: any) {
    const { playerId, side } = payload;
    const client = clients.get(playerId);
    if (!client || !client.roomId) return;

    const room = roomOps.findById.get(client.roomId) as RoomRow | undefined;
    if (!room || room.status !== 'pre_battle') return;

    const chooserPlayerId = coinCallPlayers.get(client.roomId) || room.player1_id;
    if (playerId !== chooserPlayerId) {
      sendToPlayer(playerId, { type: 'error', payload: { message: 'Only the caller can choose coin side' } });
      return;
    }

    const calledSide = side === 'charizard' ? 'charizard' : 'red';
    const resultSide = randomCoinSide();
    const opponentId = room.player1_id === playerId ? room.player2_id : room.player1_id;
    const startingPlayerId = resultSide === calledSide ? playerId : opponentId;
    if (!startingPlayerId) return;

    coinCallPlayers.delete(client.roomId);
    roomOps.setCurrentTurn.run(startingPlayerId, client.roomId);

    broadcastToRoom(client.roomId, {
      type: 'coin_flip_result',
      payload: {
        roomId: client.roomId,
        chooserPlayerId: playerId,
        calledSide,
        side: resultSide,
        startingPlayerId,
        currentTurn: startingPlayerId,
      }
    });
  }

  function handleBattleAction(ws: WebSocket, payload: any) {
    const { playerId, action, data } = payload;
    const client = clients.get(playerId);
    if (!client || !client.roomId) return;

    const room = roomOps.findById.get(client.roomId) as RoomRow | undefined;
    if (!room) return;

    // Validate turn
    if (room.current_turn && room.current_turn !== playerId) {
      sendToPlayer(playerId, { type: 'error', payload: { message: 'Not your turn' } });
      return;
    }

    const opponentId = room.player1_id === playerId ? room.player2_id : room.player1_id;
    if (opponentId) {
      roomOps.setCurrentTurn.run(opponentId, client.roomId);
    }
    
    broadcastToRoom(client.roomId, {
      type: 'battle_update',
      payload: { playerId, action, data, turnNumber: room.updated_at, currentTurn: opponentId }
    });
  }

  function handleSwitchPokemon(ws: WebSocket, payload: any) {
    handleBattleAction(ws, {
      playerId: payload.playerId,
      action: 'switch',
      data: { pokemonId: payload.pokemonId }
    });
  }

  function handleDisconnect(playerId: string) {
    const client = clients.get(playerId);
    if (!client) return;

    if (client.roomId) {
      clearBanTimer(client.roomId);
      leaveRoom(playerId, client.roomId);
    }

    playerOps.updateConnection.run(0, null, playerId);
    clients.delete(playerId);

    console.log(`🔌 Player disconnected: ${playerId}`);
  }

  return wss;
}
