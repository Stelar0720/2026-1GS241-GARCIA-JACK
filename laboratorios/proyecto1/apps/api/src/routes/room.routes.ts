// Sinnoh Edition - Room Routes (Firebase placeholder)
import { Hono } from 'hono';

const router = new Hono();

// Placeholder for Firebase Realtime Database
// In production, this would connect to Firebase Realtime Database

interface RoomState {
  id: string;
  code: string;
  status: string;
  players: string[];
  bannedPokemon: string[];
  createdAt: number;
}

// In-memory store (placeholder for Firebase)
export const roomStore: Map<string, RoomState> = new Map();

// Generate unique room code
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Create room
router.post('/create', async (c) => {
  const body = await c.req.json<{ playerId?: string }>();
  
  const room: RoomState = {
    id: crypto.randomUUID(),
    code: generateRoomCode(),
    status: 'waiting',
    players: [body.playerId || ''],
    bannedPokemon: [],
    createdAt: Date.now(),
  };

  roomStore.set(room.id, room);

  return c.json({
    success: true,
    roomId: room.id,
    code: room.code,
    status: room.status,
  });
});

// Join room
router.post('/join', async (c) => {
  const { code, playerId } = await c.req.json<{ code: string; playerId: string }>();
  
  const room = [...roomStore.values()].find(r => r.code === code);
  
  if (!room) {
    return c.json({ error: 'Room not found' }, 404);
  }

  if (room.players.length >= 2) {
    return c.json({ error: 'Room is full' }, 400);
  }

  if (!room.players.includes(playerId)) {
    room.players.push(playerId);
  }

  roomStore.set(room.id, room);

  return c.json({
    success: true,
    roomId: room.id,
    status: room.status,
    players: room.players,
  });
});

// Get room status
router.get('/:roomId', (c) => {
  const roomId = c.req.param('roomId');
  const room = roomStore.get(roomId);

  if (!room) {
    return c.json({ error: 'Room not found' }, 404);
  }

  return c.json(room);
});

// Update room status
router.patch('/:roomId/status', async (c) => {
  const roomId = c.req.param('roomId');
  const { status } = await c.req.json<{ status: string }>();
  
  const room = roomStore.get(roomId);
  if (!room) {
    return c.json({ error: 'Room not found' }, 404);
  }

  room.status = status;
  roomStore.set(roomId, room);

  return c.json({
    success: true,
    roomId,
    status,
  });
});

// Add ban
router.post('/:roomId/ban', async (c) => {
  const roomId = c.req.param('roomId');
  const { pokemonId } = await c.req.json<{ pokemonId: string }>();
  
  const room = roomStore.get(roomId);
  if (!room) {
    return c.json({ error: 'Room not found' }, 404);
  }

  if (!room.bannedPokemon.includes(pokemonId)) {
    room.bannedPokemon.push(pokemonId);
    roomStore.set(roomId, room);
  }

  return c.json({
    success: true,
    roomId,
    bannedPokemon: room.bannedPokemon,
  });
});

// Reset (cleanup for development)
router.delete('/cleanup', (c) => {
  roomStore.clear();
  return c.json({ success: true, message: 'All rooms cleared' });
});

export default router;
