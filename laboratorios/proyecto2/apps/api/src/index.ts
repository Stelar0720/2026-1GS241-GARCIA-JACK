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
  countPieces,
  getOpponent
} from './services/game.service';
import { calculateBestMove, AI_CONFIGS } from './services/ai.service';
import type { GameState, Move, Difficulty, GameMode, HealthStatus, Player, CheckersVariant } from '@checkers/shared';
// Storage para sesiones de juego
const gameSessions: Map<string, GameState> = new Map();function getInitialPieceCount(variant: CheckersVariant = 'english') {
  if (variant === 'international') return 20;
  if (variant === 'turkish') return 16;
  return 12;
}

function getCapturedCounts(board: GameState['board'], variant: CheckersVariant = 'english') {
  const remaining = countPieces(board);
  const initialPieces = getInitialPieceCount(variant);
  return {
    red: initialPieces - remaining.red,
    black: initialPieces - remaining.black
  };
}
function saveGameSession(game: GameState) {
  runQuery(
    `INSERT OR REPLACE INTO game_sessions
      (id, board, current_player, move_count, status, difficulty, game_mode, checkers_variant, winner, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM game_sessions WHERE id = ?), ?))`,
    [
      game.id,
      serializeBoard(game.board),
      game.currentPlayer,
      game.moveCount,
      game.status,
      game.difficulty || null,
      game.gameMode,
      game.checkersVariant || null,
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
  const variant = row.checkers_variant || 'english';
  const game: GameState = {
    id: row.id,
    board,
    currentPlayer: row.current_player,
    moveCount: row.move_count,
    capturedPieces: getCapturedCounts(board, variant),
    status: row.status,
    difficulty: row.difficulty || undefined,
    gameMode: row.game_mode,
    checkersVariant: variant,
    winner: row.winner || undefined
  };
  gameSessions.set(game.id, game);
  return game;
}

const stripePriceEnvBySkin: Record<string, string> = {
  gold: 'STRIPE_PRICE_GOLD',
  neon: 'STRIPE_PRICE_NEON',
  medieval: 'STRIPE_PRICE_MEDIEVAL',
  fire_ice: 'STRIPE_PRICE_FIRE_ICE',
  royal: 'STRIPE_PRICE_ROYAL'
};

const stripeSkinCatalog: Record<string, { name: string; unitAmount: number }> = {
  gold: { name: 'Gold Skin', unitAmount: 299 },
  neon: { name: 'Neon Skin', unitAmount: 299 },
  medieval: { name: 'Medieval Skin', unitAmount: 299 },
  fire_ice: { name: 'Fire & Ice Skin', unitAmount: 299 },
  royal: { name: 'Royal Skin', unitAmount: 299 }
};

function getFrontendOrigin(originHeader?: string) {
  return process.env.FRONTEND_URL || originHeader || 'http://localhost:5173';
}

let rootEnvCache: Record<string, string> | null = null;

async function readRootEnvValue(key: string) {
  if (process.env[key]) return process.env[key];

  try {
    if (!rootEnvCache) {
      const text = await Bun.file('../../.env').text();
      rootEnvCache = Object.fromEntries(
        text
          .split(/\r?\n/)
          .map((line: string) => line.trim())
          .filter((line: string) => line && !line.startsWith('#') && line.includes('='))
          .map((line: string) => {
            const separatorIndex = line.indexOf('=');
            return [line.slice(0, separatorIndex), line.slice(separatorIndex + 1)];
          })
      );
    }
    return rootEnvCache[key];
  } catch {
    return undefined;
  }
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

app.post('/api/create-checkout-session', async (c) => {
  const { skinId, clerkId } = await c.req.json() as { skinId?: string; clerkId?: string };
  const skin = skinId ? stripeSkinCatalog[skinId] : undefined;
  const priceEnvKey = skinId ? stripePriceEnvBySkin[skinId] : undefined;
  const priceId = priceEnvKey ? await readRootEnvValue(priceEnvKey) : undefined;

  if (!skinId || !skin) {
    return c.json({ error: 'Skin no valida' }, 400);
  }

  if (!clerkId) {
    return c.json({ error: 'Debes iniciar sesion para comprar skins' }, 401);
  }

  const stripeSecretKey = await readRootEnvValue('STRIPE_SECRET_KEY');
  if (!stripeSecretKey) {
    return c.json({ error: 'STRIPE_SECRET_KEY no esta configurada en el backend' }, 500);
  }

  const frontendOrigin = getFrontendOrigin(c.req.header('Origin'));
  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('line_items[0][quantity]', '1');
  params.set('success_url', `${frontendOrigin}/shop/success?skinId=${encodeURIComponent(skinId)}`);
  params.set('cancel_url', `${frontendOrigin}/shop/cancel`);
  params.set('metadata[skinId]', skinId);
  params.set('metadata[clerkId]', clerkId);
  params.set('client_reference_id', skinId);

  if (priceId && !priceId.startsWith('price_REEMPLAZAR_')) {
    params.set('line_items[0][price]', priceId);
  } else {
    // Demo universitaria: crea el precio inline para Stripe Checkout en modo test,
    // sin requerir productos ni Price IDs precreados en Stripe Dashboard.
    params.set('line_items[0][price_data][currency]', 'usd');
    params.set('line_items[0][price_data][unit_amount]', String(skin.unitAmount));
    params.set('line_items[0][price_data][product_data][name]', skin.name);
    params.set('line_items[0][price_data][product_data][description]', 'Skin cosmetica para piezas de damas');
    params.set('line_items[0][price_data][product_data][metadata][skinId]', skinId);
  }

  const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  const data = await stripeResponse.json() as { url?: string; error?: { message?: string } };
  if (!stripeResponse.ok || !data.url) {
    return c.json({ error: data.error?.message || 'Stripe no pudo crear la sesion de Checkout' }, 502);
  }

  return c.json({ url: data.url });
});

// Game Routes
app.post('/game/init', async (c) => {
  const { difficulty, gameMode, username, playerColor, checkersVariant } = await c.req.json() as {
    difficulty?: Difficulty;
    gameMode?: GameMode;
    username?: string;
    playerColor?: Player;
    checkersVariant?: CheckersVariant;
  };

  const variant = checkersVariant || 'english';
  const game = createGameState(difficulty, gameMode || 'pva', variant);

  if (game.gameMode === 'pva' && playerColor === 'red') {
    const aiMove = calculateBestMove(game.board, game.difficulty || 'medium', 'black', variant);
    if (aiMove) {
      game.board = applyMove(game.board, aiMove, 'black', variant);
      game.moveCount++;
      game.capturedPieces = getCapturedCounts(game.board, variant);
      game.currentPlayer = 'red';
    }
  }

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
  const { gameId, move, username, clerkId, playerColor, checkersVariant } = await c.req.json() as {
    gameId: string;
    move: Move;
    username?: string;
    clerkId?: string;
    playerColor?: Player;
    checkersVariant?: CheckersVariant;
  };

  const game = gameSessions.get(gameId) || loadGameSession(gameId);
  if (!game) {
    return c.json({ error: 'Game not found' }, 404);
  }

  if (game.status !== 'playing') {
    return c.json({ error: 'Game is not in play' }, 400);
  }

  const humanPlayer: Player = playerColor || 'black';
  const aiPlayer = getOpponent(humanPlayer);
  const variant = checkersVariant || game.checkersVariant || 'english';
  if (game.gameMode === 'pva' && game.currentPlayer !== humanPlayer) {
    return c.json({ error: 'It is not the human player turn' }, 400);
  }

  // Validar movimiento
  const legalMoves = getLegalMoves(game.board, game.currentPlayer, variant);
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
  const legalMove = legalMoves.find(m =>
    m.from.row === move.from.row &&
    m.from.col === move.from.col &&
    m.to.row === move.to.row &&
    m.to.col === move.to.col
  );
  const newBoard = applyMove(game.board, legalMove || move, game.currentPlayer, variant);
  game.board = newBoard;
  game.moveCount++;
  game.capturedPieces = getCapturedCounts(game.board, variant);
  game.currentPlayer = game.currentPlayer === 'red' ? 'black' : 'red';

  // Verificar fin del juego
  const gameOverResult = checkGameOver(game.board, game.currentPlayer, variant);
  if (gameOverResult.isOver) {
    game.status = gameOverResult.status;
    if (gameOverResult.winner) {
      game.winner = gameOverResult.winner;
    }
  }

  let aiMove: Move | null = null;
  
  // Turno de la IA
  if (game.gameMode === 'pva' && game.status === 'playing' && game.currentPlayer === aiPlayer) {
    aiMove = calculateBestMove(game.board, game.difficulty || 'medium', aiPlayer, variant);
    if (aiMove) {
      const aiBoard = applyMove(game.board, aiMove, aiPlayer, variant);
      game.board = aiBoard;
      game.moveCount++;
      game.capturedPieces = getCapturedCounts(game.board, variant);
      game.currentPlayer = humanPlayer;

      const afterAIGameOver = checkGameOver(game.board, game.currentPlayer, variant);
      if (afterAIGameOver.isOver) {
        game.status = afterAIGameOver.status;
        if (afterAIGameOver.winner) {
          game.winner = afterAIGameOver.winner;
        }
      }
    }
  }

  // Guardar ranking solo para partidas terminadas de usuarios autenticados con Clerk
  if ((game.status === 'won' || game.status === 'draw') && username && clerkId) {
    const result = game.status === 'draw'
      ? 'defeat'
      : game.winner === humanPlayer ? 'victory' : 'defeat';
    const existingRanking = selectQuery(
      `SELECT id FROM rankings WHERE clerk_id = ? AND device_hash = ? LIMIT 1`,
      [clerkId, game.id]
    );
    if (existingRanking.length === 0) {
    runQuery(
      `INSERT INTO rankings (username, moves, difficulty, game_mode, result, checkers_variant, created_at, device_hash, clerk_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [username, game.moveCount, game.difficulty || 'medium', game.gameMode, result, variant, Date.now(), game.id, clerkId]
    );
    }
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
      { value: 'medium', label: 'Medio', description: 'Nivel intermedio - busqueda A*' },
      { value: 'hard', label: 'Difícil', description: 'Nivel experto - IA con 6 movimientos de profundidad' }
    ]
  });
});

// Ranking Routes
app.post('/ranking', async (c) => {
  const { username, moves, difficulty, gameMode, clerkId, result, checkersVariant } = await c.req.json() as {
    username: string;
    moves: number;
    difficulty: Difficulty;
    gameMode: GameMode;
    clerkId?: string;
    result?: 'victory' | 'defeat';
    checkersVariant?: CheckersVariant;
  };

  if (!clerkId) {
    return c.json({ error: 'Clerk user is required to save rankings' }, 401);
  }

  runQuery(
    `INSERT INTO rankings (username, moves, difficulty, game_mode, result, checkers_variant, created_at, clerk_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [username, moves, difficulty, gameMode, result || 'victory', checkersVariant || 'english', Date.now(), clerkId || null]
  );

  return c.json({ success: true, message: 'Ranking saved' });
});

app.get('/ranking/top', (c) => {
  const limit = parseInt(c.req.query('limit') || '5');
  const difficulty = c.req.query('difficulty') as Difficulty | undefined;
  const gameMode = c.req.query('gameMode') as GameMode | undefined;

  const buildSql = (result: 'victory' | 'defeat') => {
    let sql = `SELECT * FROM rankings WHERE clerk_id IS NOT NULL AND COALESCE(result, 'victory') = ?`;
    const params: any[] = [result];

    if (difficulty) {
      sql += ` AND difficulty = ?`;
      params.push(difficulty);
    }
    if (gameMode) {
      sql += ` AND game_mode = ?`;
      params.push(gameMode);
    }

    sql += result === 'victory'
      ? ` ORDER BY moves ASC LIMIT ?`
      : ` ORDER BY moves DESC LIMIT ?`;
    params.push(limit);
    return { sql, params };
  };

  const victoryQuery = buildSql('victory');
  const defeatQuery = buildSql('defeat');
  const victories = selectQuery(victoryQuery.sql, victoryQuery.params);
  const defeats = selectQuery(defeatQuery.sql, defeatQuery.params);

  return c.json({
    success: true,
    victories: victories.map(mapRankingRow),
    defeats: defeats.map(mapRankingRow),
    rankings: victories.map(mapRankingRow)
  });
});

function mapRankingRow(r: any) {
  return {
    id: r.id,
    username: r.username,
    moves: r.moves,
    difficulty: r.difficulty,
    gameMode: r.game_mode,
    result: r.result || 'victory',
    checkersVariant: r.checkers_variant || 'english',
    createdAt: new Date(r.created_at),
    deviceHash: r.device_hash,
    clerkId: r.clerk_id
  };
}

app.get('/ranking/legacy-top', (c) => {
  const limit = parseInt(c.req.query('limit') || '10');
  const difficulty = c.req.query('difficulty') as Difficulty | undefined;
  const gameMode = c.req.query('gameMode') as GameMode | undefined;

  let sql = `SELECT * FROM rankings WHERE clerk_id IS NOT NULL`;
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
    rankings: results.map(mapRankingRow)
  });
});

app.get('/ranking/clerk/:clerkId', (c) => {
  const clerkId = c.req.param('clerkId');
  const victories = selectQuery(
    `SELECT * FROM rankings WHERE clerk_id = ? AND COALESCE(result, 'victory') = 'victory' ORDER BY moves ASC LIMIT 5`,
    [clerkId]
  );
  const defeats = selectQuery(
    `SELECT * FROM rankings WHERE clerk_id = ? AND COALESCE(result, 'victory') = 'defeat' ORDER BY moves DESC LIMIT 5`,
    [clerkId]
  );

  return c.json({
    success: true,
    clerkId,
    victories: victories.map(mapRankingRow),
    defeats: defeats.map(mapRankingRow),
    rankings: victories.map(mapRankingRow)
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
    rankings: results.map(mapRankingRow)
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
