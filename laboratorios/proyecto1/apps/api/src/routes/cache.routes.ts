// Sinnoh Edition - Cache Routes
import { Hono } from 'hono';
import pokeAPICache from '../services/cache.service.js';

const router = new Hono();

// Get cache status
router.get('/status', (c) => {
  const stats = pokeAPICache.getCacheStats();
  return c.json({
    status: 'ok',
    cacheSize: stats.size,
    generationCacheSize: stats.generationCacheSize,
    timestamp: Date.now(),
  });
});

// Get type chart
router.get('/types', async (c) => {
  try {
    const types = await pokeAPICache.getTypeChart();
    return c.json(types);
  } catch (error) {
    return c.json({ error: 'Failed to fetch types' }, 500);
  }
});

// Clear cache
router.post('/clear', (c) => {
  pokeAPICache.clearCache();
  return c.json({ 
    status: 'ok',
    message: 'Cache cleared successfully',
    timestamp: Date.now(),
  });
});

// Re-seed generation
router.post('/seed/:gen', async (c) => {
  const gen = parseInt(c.req.param('gen'));
  if (isNaN(gen) || gen < 1 || gen > 9) {
    return c.json({ error: 'Invalid generation' }, 400);
  }

  try {
    const ids = await pokeAPICache.getGenerationPokemons(gen);
    return c.json({
      generation: gen,
      pokemonCount: ids.length,
      status: 'seeded',
    });
  } catch (error) {
    return c.json({ error: 'Failed to seed generation' }, 500);
  }
});

export default router;
