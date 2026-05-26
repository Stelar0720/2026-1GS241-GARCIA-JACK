import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { initializeDatabase, runQuery, selectQuery, rankings as rankingsTable, heartbeats as heartbeatsTable } from './db/schema';
import {
  createGameState,
  getLegalMoves,
  applyMove,
  checkGameOver,
  serializeBoard,
  deserializeBoard,
  countPieces
} from './services/game.service';
import { calculateBestMove, AI_CONFIGS } from './services/ai.service';
import type { GameState, Move, Difficulty, GameMode, HealthStatus } from '@checkers/shared';
// Storage para sesiones de juego
const gameSessions: Map<string, GameState> = new Map();function getCapturedCounts(board: GameState['board']) {
  const remaining = countPieces(board);
  return {
    red: 12 - remaining.red,
    black: 12 - remaining.black
  };
}
function saveGameSession(game: GameState) {
  runQuery(
    `INSERT OR REPLACE INTO game_sessions
      (id, board, current_player, move_count, status, difficulty, game_mode, winner, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM game_sessions WHERE id = ?), ?))`,
    [
      game.id,
      serializeBoard(game.board),
      game.currentPlayer,
      game.moveCount,
      game.status,
      game.difficulty || null,
      game.gameMode,
      game.winner || null,
      game.id,
      Date.now()
    ]
  );
}

function loadGameSession(gameId: string): GameState | null {
  const rows = selectQuery(`SELECT * FROM game_sessions WHERE id = ? LIMIT 1`, [gameId]);
  const row = rows[0];
  if (!row) return null;

  const board = deserializeBoard(row.board);
  const game: GameState = {
    id: row.id,
    board,
    currentPlayer: row.current_player,
    moveCount: row.move_count,
    capturedPieces: getCapturedCounts(board),
    status: row.status,
    difficulty: row.difficulty || undefined,
    gameMode: row.game_mode,
    winner: row.winner || undefined
  };
  gameSessions.set(game.id, game);
  return game;
}

// ============== ROUTES ==============

const app = new Hono();

// Middleware CORS
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'x-clerk-id']
}));

// Health Check
app.get('/health', (c) => {
  const status: HealthStatus = {
    service: 'api',
    status: 'healthy',
    timestamp: new Date()
  };
  
  runQuery(
    `INSERT INTO heartbeats (service_name, status, timestamp, metadata) VALUES (?, ?, ?, ?)`,
    ['api', 'healthy', Date.now(), JSON.stringify({ uptime: process.uptime() })]
  );
  
  return c.json(status);
});

app.get('/health/all', (c) => {
  const allServices: HealthStatus[] = [
    { service: 'api', status: 'healthy', timestamp: new Date() },
    { service: 'game', status: 'healthy', timestamp: new Date() },
    { service: 'ai', status: 'healthy', timestamp: new Date() },
    { service: 'ranking', status: 'healthy', timestamp: new Date() },
    { service: 'kernel', status: 'healthy', timestamp: new Date() },
    { service: 'heartbeat', status: 'healthy', timestamp: new Date() }
  ];
  return c.json(allServices);
});

// Kernel Stats
app.get('/kernel/stats', (c) => {
  return c.json({
    activeGames: gameSessions.size,
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    timestamp: new Date()
  });
});

// Game Routes
app.post('/game/init', async (c) => {
  const { difficulty, gameMode, username } = await c.req.json() as {
    difficulty?: Difficulty;
    gameMode?: GameMode;
    username?: string;
  };

  const game = createGameState(difficulty, gameMode || 'pva');
  gameSessions.set(game.id, game);
  saveGameSession(game);

  return c.json({
    success: true,
    gameId: game.id,
    game,
    username
  });
});

app.get('/game/state/:id', (c) => {
  const gameId = c.req.param('id');
  const game = gameSessions.get(gameId) || loadGameSession(gameId);

  if (!game) {
    return c.json({ error: 'Game not found' }, 404);
  }

  return c.json(game);
});

app.post('/game/move', async (c) => {
  const { gameId, move, username, clerkId } = await c.req.json() as {
    gameId: string;
    move: Move;
    username?: string;
    clerkId?: string;
  };

  const game = gameSessions.get(gameId) || loadGameSession(gameId);
  if (!game) {
    return c.json({ error: 'Game not found' }, 404);
  }

  if (game.status !== 'playing') {
    return c.json({ error: 'Game is not in play' }, 400);
  }

  // Validar movimiento
  const legalMoves = getLegalMoves(game.board, game.currentPlayer);
  const isValidMove = legalMoves.some(m =>
    m.from.row === move.from.row &&
    m.from.col === move.from.col &&
    m.to.row === move.to.row &&
    m.to.col === move.to.col
  );

  if (!isValidMove) {
    return c.json({ error: 'Invalid move' }, 400);
  }

  // Aplicar movimiento
  const newBoard = applyMove(game.board, move, game.currentPlayer);
  game.board = newBoard;
  game.moveCount++;
  game.capturedPieces = getCapturedCounts(game.board);
  game.currentPlayer = game.currentPlayer === 'red' ? 'black' : 'red';

  // Verificar fin del juego
  const gameOverResult = checkGameOver(game.board, game.currentPlayer);
  if (gameOverResult.isOver) {
    game.status = gameOverResult.status;
    if (gameOverResult.winner) {
      game.winner = gameOverResult.winner;
    }
  }

  let aiMove: Move | null = null;
  
  // Turno de la IA
  if (game.gameMode === 'pva' && game.status === 'playing' && game.currentPlayer === 'red') {
    aiMove = calculateBestMove(game.board, game.difficulty || 'medium');
    if (aiMove) {
      const aiBoard = applyMove(game.board, aiMove, 'red');
      game.board = aiBoard;
      game.moveCount++;
      game.capturedPieces = getCapturedCounts(game.board);
      game.currentPlayer = 'black';

      const afterAIGameOver = checkGameOver(game.board, game.currentPlayer);
      if (afterAIGameOver.isOver) {
        game.status = afterAIGameOver.status;
        if (afterAIGameOver.winner) {
          game.winner = afterAIGameOver.winner;
        }
      }
    }
  }

  // Guardar ranking si terminó
  if ((game.status === 'won' || game.status === 'draw') && username) {
    runQuery(
      `INSERT INTO rankings (username, moves, difficulty, game_mode, created_at, device_hash, clerk_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [username, game.moveCount, game.difficulty || 'medium', game.gameMode, Date.now(), null, clerkId || null]
    );
  }

  saveGameSession(game);

  return c.json({
    success: true,
    game,
    playerMove: move,
    aiMove
  });
});

// AI Routes
app.post('/ai/move', async (c) => {
  const { board, difficulty } = await c.req.json() as { board: any[][]; difficulty?: Difficulty };
  const move = calculateBestMove(board, difficulty || 'medium');
  return c.json({ success: true, move });
});

app.get('/ai/difficulty', (c) => {
  return c.json({
    difficulties: [
      { value: 'easy', label: 'Fácil', description: 'Nivel principiante - IA con 2 movimientos de profundidad' },
      { value: 'medium', label: 'Medio', description: 'Nivel intermedio - IA con alpha-beta pruning' },
      { value: 'hard', label: 'Difícil', description: 'Nivel experto - IA con 6 movimientos de profundidad' }
    ]
  });
});

// Ranking Routes
app.post('/ranking', async (c) => {
  const { username, moves, difficulty, gameMode, clerkId } = await c.req.json() as {
    username: string;
    moves: number;
    difficulty: Difficulty;
    gameMode: GameMode;
    clerkId?: string;
  };

  runQuery(
    `INSERT INTO rankings (username, moves, difficulty, game_mode, created_at, clerk_id) VALUES (?, ?, ?, ?, ?, ?)`,
    [username, moves, difficulty, gameMode, Date.now(), clerkId || null]
  );

  return c.json({ success: true, message: 'Ranking saved' });
});

app.get('/ranking/top', (c) => {
  const limit = parseInt(c.req.query('limit') || '10');
  const difficulty = c.req.query('difficulty') as Difficulty | undefined;
  const gameMode = c.req.query('gameMode') as GameMode | undefined;

  let sql = `SELECT * FROM rankings WHERE 1=1`;
  const params: any[] = [];

  if (difficulty) {
    sql += ` AND difficulty = ?`;
    params.push(difficulty);
  }
  if (gameMode) {
    sql += ` AND game_mode = ?`;
    params.push(gameMode);
  }

  sql += ` ORDER BY moves ASC LIMIT ?`;
  params.push(limit);

  const results = selectQuery(sql, params);

  return c.json({
    success: true,
    rankings: results.map(r => ({
      id: r.id,
      username: r.username,
      moves: r.moves,
      difficulty: r.difficulty,
      gameMode: r.game_mode,
      createdAt: new Date(r.created_at),
      deviceHash: r.device_hash,
      clerkId: r.clerk_id
    }))
  });
});

app.get('/ranking/clerk/:clerkId', (c) => {
  const clerkId = c.req.param('clerkId');
  const results = selectQuery(
    `SELECT * FROM rankings WHERE clerk_id = ? ORDER BY moves ASC LIMIT 20`,
    [clerkId]
  );

  return c.json({
    success: true,
    clerkId,
    rankings: results.map(r => ({
      id: r.id,
      username: r.username,
      moves: r.moves,
      difficulty: r.difficulty,
      gameMode: r.game_mode,
      createdAt: new Date(r.created_at)
}))
  });
});

app.get('/ranking/user/:username', (c) => {
  const username = c.req.param('username');
  const results = selectQuery(
    `SELECT * FROM rankings WHERE username = ? ORDER BY moves ASC`,
    [username]
  );

  return c.json({
    success: true,
    username,
    rankings: results.map(r => ({
      id: r.id,
      username: r.username,
      moves: r.moves,
      difficulty: r.difficulty,
      gameMode: r.game_mode,
      createdAt: new Date(r.created_at)
    }))
  });
});

// OS/Heartbeat Routes
app.get('/os/uptime', (c) => {
  return c.json({ uptime: process.uptime(), timestamp: new Date() });
});

app.get('/os/memory', (c) => {
  const mem = process.memoryUsage();
  return c.json({
    heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + 'MB',
    heapTotal: Math.round(mem.heapTotal / 1024 / 1024) + 'MB',
    rss: Math.round(mem.rss / 1024 / 1024) + 'MB'
  });
});

// Iniciar servidor
const port = parseInt(process.env.PORT || '3001');

console.log(`
╔════════════════════════════════════════════════════════════╗
║                    CHECKERS API SERVER                     ║
╠════════════════════════════════════════════════════════════╣
║  🎮 Game Service:  /game/*                                ║
║  🤖 AI Service:    /ai/*                                  ║
║  🏆 Ranking Service: /ranking/*                          ║
║  💓 Heartbeat:     /health/*                              ║
║  ⚙️ Kernel:        /kernel/*                               ║
║  👤 Clerk Auth:    Soporte para auth vía x-clerk-id       ║
╠════════════════════════════════════════════════════════════╣
║  Servidor ejecutándose en puerto ${port.toString().padStart(5)}                      ║
╚════════════════════════════════════════════════════════════╝
`);

// Inicializar DB y servidor
async function start() {
  try {
    await initializeDatabase();
    console.log('✅ Base de datos SQLite inicializada');

    serve({
      fetch: app.fetch,
      port
    });
    console.log(`✅ Servidor iniciado en http://localhost:${port}`);
  } catch (error) {
    console.error('❌ Error al iniciar:', error);
    process.exit(1);
  }
}

start();

export { app };
