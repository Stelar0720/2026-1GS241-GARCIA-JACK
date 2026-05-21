// Sinnoh Edition - API Main Entry with WebSocket
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import pokemonRoutes from './routes/pokemon.routes.js';
import cacheRoutes from './routes/cache.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import { setupWebSocketServer } from './services/websocket.service.js';

const app = new Hono();

// CORS for frontend
app.use('/*', cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));

// Routes
app.route('/api/pokemon', pokemonRoutes);
app.route('/api/cache', cacheRoutes);
app.route('/api/payments', paymentRoutes);

// Health check
app.get('/health', (c) => c.json({ 
  status: 'ok', 
  service: 'Sinnoh Edition API',
  websocket: 'ws://localhost:3001',
  timestamp: Date.now() 
}));

// PokéAPI proxy - get all generations
app.get('/api/generations', async (c) => {
  try {
    const response = await fetch('https://pokeapi.co/api/v2/generation');
    const data = await response.json();
    return c.json(data);
  } catch (error) {
    return c.json({ error: 'Failed to fetch generations' }, 500);
  }
});

// Start HTTP server
const httpPort = 3000;
console.log(`🏛️ Sinnoh Edition API running on http://localhost:${httpPort}`);

serve({
  fetch: app.fetch,
  port: httpPort
});

// Start WebSocket server
setupWebSocketServer(3001);

console.log('✨ Sinnoh Edition ready for multiplayer!');