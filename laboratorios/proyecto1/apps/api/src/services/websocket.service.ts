// Sinnoh Edition - WebSocket Server
import { WebSocketServer, WebSocket, RawData } from 'ws';
import { roomOps, playerOps, banOps, teamOps, generateRoomCode } from './database.service.js';
import type { BanRow, RoomRow } from './database.service.js';

interface Client {
  ws: WebSocket;
  playerId: string;
  roomId: string | null;
}

interface Message {
  type: string;
  payload: any;
}

const clients = new Map<string, Client>();
const rooms = new Map<string, Set<string>>(); // roomId -> Set<playerId>

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
      payload: { roomId: room.id, code, status: 'waiting', player1Id: room.player1_id }
    });

    if (room.player1_id) {
      sendToPlayer(room.player1_id, {
        type: 'opponent_joined',
        payload: { roomId: room.id, opponentId: playerId }
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
      roomOps.updateStatus.run('ban_phase', client.roomId);
      
      broadcastToRoom(client.roomId, {
        type: 'phase_change',
        payload: { phase: 'ban_phase', roomId: client.roomId }
      });
    }
  }

  function handleBanPokemon(ws: WebSocket, payload: any) {
    const { playerId, pokemonId } = payload;
    const client = clients.get(playerId);
    if (!client || !client.roomId) return;

    // Check ban limit (3 per player)
    const bans = banOps.findByRoom.all(client.roomId) as BanRow[];
    const playerBans = bans.filter((b: BanRow) => b.player_id === playerId);
    const alreadyBanned = bans.some((b: BanRow) => b.pokemon_id === pokemonId);
    
    if (playerBans.length >= 3) {
      sendToPlayer(playerId, { type: 'error', payload: { message: 'Ban limit reached' } });
      return;
    }

    if (alreadyBanned) {
      sendToPlayer(playerId, { type: 'error', payload: { message: 'Pokemon already banned' } });
      return;
    }

    // Add ban
    banOps.add.run(client.roomId, playerId, pokemonId);

    // Broadcast
    broadcastToRoom(client.roomId, {
      type: 'pokemon_banned',
      payload: { playerId, pokemonId, roomId: client.roomId }
    });

    // Check if all bans complete
    const allBans = banOps.findByRoom.all(client.roomId) as BanRow[];
    if (allBans.length >= 6) { // 3 + 3
      roomOps.updateStatus.run('team_select', client.roomId);
      
      broadcastToRoom(client.roomId, {
        type: 'phase_change',
        payload: { phase: 'team_select', roomId: client.roomId, bans: allBans.map((b: BanRow) => b.pokemon_id) }
      });
    }
  }

  function handleSelectTeam(ws: WebSocket, payload: any) {
    const { playerId, team } = payload;
    const client = clients.get(playerId);
    if (!client || !client.roomId) return;

    // Save team
    teamOps.save.run(client.roomId, playerId, JSON.stringify(team));

    // Broadcast team selected
    broadcastToRoom(client.roomId, {
      type: 'team_selected',
      payload: { playerId, roomId: client.roomId }
    });

    // Check if both teams selected
    const updatedRoom = roomOps.findById.get(client.roomId) as RoomRow | undefined;
    
    if (updatedRoom) {
      const p1Team = teamOps.findByRoomAndPlayer.get(client.roomId, updatedRoom.player1_id);
      const p2Team = teamOps.findByRoomAndPlayer.get(client.roomId, updatedRoom.player2_id);

      if (p1Team && p2Team) {
        roomOps.updateStatus.run('pre_battle', client.roomId);
        
        broadcastToRoom(client.roomId, {
          type: 'phase_change',
          payload: { phase: 'pre_battle', roomId: client.roomId }
        });
      }
    }
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

    // Broadcast action to opponent
    const opponentId = room.player1_id === playerId ? room.player2_id : room.player1_id;
    
    broadcastToRoom(client.roomId, {
      type: 'battle_update',
      payload: { playerId, action, data, turnNumber: room.updated_at }
    });

    // Simple turn alternation for MVP
    if (opponentId) {
      roomOps.setCurrentTurn.run(opponentId, client.roomId);
    }
  }

  function handleSwitchPokemon(ws: WebSocket, payload: any) {
    handleBattleAction(ws, { ...payload, action: 'switch' });
  }

  function handleDisconnect(playerId: string) {
    const client = clients.get(playerId);
    if (!client) return;

    if (client.roomId) {
      leaveRoom(playerId, client.roomId);
    }

    playerOps.updateConnection.run(0, null, playerId);
    clients.delete(playerId);

    console.log(`🔌 Player disconnected: ${playerId}`);
  }

  return wss;
}
