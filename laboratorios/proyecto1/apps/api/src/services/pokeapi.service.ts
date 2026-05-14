// Sinnoh Edition - PokéAPI Service
// Handles fetching and caching Pokémon data from PokéAPI

import type { CachePokemon, Move, PokemonType } from '../../../../packages/shared/src/types.js';

const POKEAPI_BASE = 'https://pokeapi.co/api/v2';

export interface PokeAPIResponse {
  id: number;
  name: string;
  height: number;
  weight: number;
  types: { slot: number; type: { name: string; url: string } }[];
  sprites: {
    front_default: string;
    back_default: string;
    front_shiny: string | null;
    back_shiny: string | null;
  };
  stats: { base_stat: number; stat: { name: string } }[];
  moves: { move: { url: string }; version_group_details: { level_learned_at: number }[] }[];
}

export interface MoveResponse {
  id: number;
  name: string;
  type: { name: string };
  power: number | null;
  accuracy: number | null;
  pp: number | null;
}

export interface GenerationInfo {
  id: number;
  name: string;
  minId: number;
  maxId: number;
}

export const GENERATIONS: GenerationInfo[] = [
  { id: 1, name: 'Kanto', minId: 1, maxId: 151 },
  { id: 2, name: 'Johto', minId: 152, maxId: 251 },
  { id: 3, name: 'Hoenn', minId: 252, maxId: 386 },
  { id: 4, name: 'Sinnoh', minId: 387, maxId: 493 },
  { id: 5, name: 'Teselia', minId: 494, maxId: 649 },
  { id: 6, name: 'Kalos', minId: 650, maxId: 721 },
  { id: 7, name: 'Alola', minId: 722, maxId: 809 },
  { id: 8, name: 'Galar', minId: 810, maxId: 905 },
  { id: 9, name: 'Paldea', minId: 906, maxId: 1025 },
];

const cache = new Map<number, CachePokemon>();
const generationCache = new Map<number, number[]>();

/**
 * Get generation info for an ID
 */
export function getGenerationById(id: number): number {
  if (id <= 151) return 1;
  if (id <= 251) return 2;
  if (id <= 386) return 3;
  if (id <= 493) return 4;
  if (id <= 649) return 5;
  if (id <= 721) return 6;
  if (id <= 809) return 7;
  if (id <= 905) return 8;
  return 9;
}

/**
 * Format Pokémon name
 */
function formatName(name: string): string {
  return name
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Transform API response to CachePokemon
 */
function transformPokemon(data: PokeAPIResponse): CachePokemon {
  const statsMap: Record<string, number> = {};
  for (const stat of data.stats) {
    statsMap[stat.stat.name] = stat.base_stat;
  }

  return {
    id: data.id,
    name: formatName(data.name),
    nameJp: data.name,
    generation: getGenerationById(data.id),
    types: data.types.sort((a, b) => a.slot - b.slot).map(t => t.type.name as PokemonType),
    spriteFront: data.sprites.front_default || '',
    spriteBack: data.sprites.back_default || '',
    spriteShinyFront: data.sprites.front_shiny || undefined,
    spriteShinyBack: data.sprites.back_shiny || undefined,
    stats: {
      hp: statsMap['hp'] || 100,
      attack: statsMap['attack'] || 100,
      defense: statsMap['defense'] || 100,
      specialAttack: statsMap['special-attack'] || 100,
      specialDefense: statsMap['special-defense'] || 100,
      speed: statsMap['speed'] || 100,
    },
    moves: [],
    height: data.height,
    weight: data.weight,
  };
}

/**
 * Get Pokémon by ID
 */
export async function getPokemon(id: number): Promise<CachePokemon | null> {
  if (cache.has(id)) {
    return cache.get(id)!;
  }

  try {
    const response = await fetch(`${POKEAPI_BASE}/pokemon/${id}`);
    if (!response.ok) return null;

    const data = await response.json() as PokeAPIResponse;
    const pokemon = transformPokemon(data);
    
    cache.set(id, pokemon);
    return pokemon;
  } catch (error) {
    console.error(`Failed to fetch Pokémon ${id}:`, error);
    return null;
  }
}

/**
 * Get Pokémon by name
 */
export async function getPokemonByName(name: string): Promise<CachePokemon | null> {
  // Check cache first
  for (const [, pokemon] of cache) {
    if (pokemon.name.toLowerCase() === name.toLowerCase()) {
      return pokemon;
    }
  }

  try {
    const response = await fetch(`${POKEAPI_BASE}/pokemon/${name.toLowerCase()}`);
    if (!response.ok) return null;

    const data = await response.json() as PokeAPIResponse;
    const pokemon = transformPokemon(data);
    
    cache.set(pokemon.id, pokemon);
    return pokemon;
  } catch (error) {
    console.error(`Failed to fetch Pokémon ${name}:`, error);
    return null;
  }
}

/**
 * Get moves for a Pokémon
 */
export async function getMovesForPokemon(pokemonId: number, limit: number = 50): Promise<Move[]> {
  try {
    const response = await fetch(`${POKEAPI_BASE}/pokemon/${pokemonId}`);
    if (!response.ok) return [];

    const data = await response.json() as { moves: { move: { url: string } }[] };
    const moves: Move[] = [];

    const limitedMoves = data.moves.slice(0, limit);

    for (const moveRef of limitedMoves) {
      try {
        const moveResponse = await fetch(moveRef.move.url);
        if (moveResponse.ok) {
          const moveData: MoveResponse = await moveResponse.json();
          moves.push({
            id: moveData.id,
            name: formatName(moveData.name),
            type: moveData.type.name as PokemonType,
            power: moveData.power ?? 0,
            accuracy: moveData.accuracy ?? 100,
            pp: moveData.pp ?? 20,
            maxPp: moveData.pp ?? 20,
          });
        }
      } catch {
        continue;
      }
    }

    return moves;
  } catch (error) {
    console.error(`Failed to fetch moves for ${pokemonId}:`, error);
    return [];
  }
}

/**
 * Get Pokémon IDs for a generation
 */
export async function getGenerationPokemons(gen: number): Promise<number[]> {
  if (generationCache.has(gen)) {
    return generationCache.get(gen)!;
  }

  try {
    const response = await fetch(`${POKEAPI_BASE}/generation/${gen}`);
    if (!response.ok) return [];

    const data = await response.json() as { pokemon_species: { url: string }[] };
    const ids = data.pokemon_species.map(({ url }) => {
      const parts = url.split('/').filter(Boolean);
      return parseInt(parts[parts.length - 1]);
    });

    generationCache.set(gen, ids);
    return ids;
  } catch (error) {
    console.error(`Failed to fetch generation ${gen}:`, error);
    return [];
  }
}

/**
 * Get cache stats
 */
export function getCacheStats(): { pokemonCount: number; generationCount: number } {
  return {
    pokemonCount: cache.size,
    generationCount: generationCache.size,
  };
}

/**
 * Clear cache
 */
export function clearCache(): void {
  cache.clear();
  generationCache.clear();
}

export default {
  getPokemon,
  getPokemonByName,
  getMovesForPokemon,
  getGenerationPokemons,
  getCacheStats,
  clearCache,
  GENERATIONS,
};
