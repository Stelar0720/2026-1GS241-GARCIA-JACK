// Sinnoh Edition - Pokémon Routes
import { Hono } from 'hono';
import pokeAPICache from '../services/cache.service.js';

const router = new Hono();

// Search pokemon by name
router.get('/search/:name', async (c) => {
  const name = c.req.param('name');
  
  try {
    const pokemon = await pokeAPICache.getPokemonByName(name);
    if (!pokemon) {
      return c.json({ error: 'Pokemon not found' }, 404);
    }
    return c.json(pokemon);
  } catch (error) {
    return c.json({ error: 'Failed to search pokemon' }, 500);
  }
});

// Get generation pokemons
router.get('/generation/:gen', async (c) => {
  const gen = parseInt(c.req.param('gen'));
  if (isNaN(gen) || gen < 1 || gen > 9) {
    return c.json({ error: 'Invalid generation' }, 400);
  }

  try {
    const ids = await pokeAPICache.getGenerationPokemons(gen);
    
    // Fetch limited pokemons for performance
    const limitedIds = ids.slice(0, 50);
    const pokemons = await Promise.all(
      limitedIds.map(id => pokeAPICache.getPokemon(id))
    );

    return c.json({
      generation: gen,
      count: pokemons.length,
      pokemons: pokemons.filter(Boolean),
    });
  } catch (error) {
    return c.json({ error: 'Failed to fetch generation' }, 500);
  }
});

// Get moves for pokemon
router.get('/:id/moves', async (c) => {
  const id = parseInt(c.req.param('id'));
  if (isNaN(id) || id < 1) {
    return c.json({ error: 'Invalid pokemon ID' }, 400);
  }

  try {
    const moves = await pokeAPICache.getMovesForPokemon(id);
    return c.json({
      pokemonId: id,
      moves,
      count: moves.length,
    });
  } catch (error) {
    return c.json({ error: 'Failed to fetch moves' }, 500);
  }
});

// Get all generations summary
router.get('/generations/summary', async (c) => {
  const generations = [
    { gen: 1, name: 'Kanto', min: 1, max: 151 },
    { gen: 2, name: 'Johto', min: 152, max: 251 },
    { gen: 3, name: 'Hoenn', min: 252, max: 386 },
    { gen: 4, name: 'Sinnoh', min: 387, max: 493 },
    { gen: 5, name: 'Teselia', min: 494, max: 649 },
    { gen: 6, name: 'Kalos', min: 650, max: 721 },
    { gen: 7, name: 'Alola', min: 722, max: 809 },
    { gen: 8, name: 'Galar', min: 810, max: 905 },
    { gen: 9, name: 'Paldea', min: 906, max: 1025 },
  ];

  return c.json({
    generations,
    total: generations.length,
  });
});

// Get pokemon by ID
router.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  if (isNaN(id) || id < 1) {
    return c.json({ error: 'Invalid pokemon ID' }, 400);
  }

  try {
    const pokemon = await pokeAPICache.getPokemon(id);
    if (!pokemon) {
      return c.json({ error: 'Pokemon not found' }, 404);
    }
    return c.json(pokemon);
  } catch (error) {
    return c.json({ error: 'Failed to fetch pokemon' }, 500);
  }
});

export default router;
