// Sinnoh Edition - Seed Pokemon
// Utility for seeding initial Pokemon data into the cache

import type { CachePokemon } from '../../shared/src/types.js';

export interface SeedConfig {
  generations: number[];
  limitPerGeneration: number;
  batchSize: number;
  delayBetweenRequests: number;
}

const DEFAULT_SEED_CONFIG: SeedConfig = {
  generations: [1, 2, 3, 4], // Kanto through Sinnoh for Sinnoh Edition
  limitPerGeneration: 50,
  batchSize: 10,
  delayBetweenRequests: 100,
};

/**
 * Get list of Pokemon IDs to seed from a generation
 */
export function getSeedList(config: Partial<SeedConfig> = {}): number[] {
  const { generations, limitPerGeneration } = { ...DEFAULT_SEED_CONFIG, ...config };
  const ids: number[] = [];

  for (const gen of generations) {
    const [minId, maxId] = getGenerationRange(gen);
    const genIds = Array.from(
      { length: Math.min(maxId - minId + 1, limitPerGeneration) },
      (_, i) => minId + i
    );
    ids.push(...genIds);
  }

  return ids;
}

/**
 * Get generation ID range
 */
export function getGenerationRange(gen: number): [number, number] {
  const ranges: Record<number, [number, number]> = {
    1: [1, 151],
    2: [152, 251],
    3: [252, 386],
    4: [387, 493],
    5: [494, 649],
    6: [650, 721],
    7: [722, 809],
    8: [810, 905],
    9: [906, 1025],
  };
  return ranges[gen] || [1, 151];
}

/**
 * Transform PokeAPI response to CachePokemon format
 */
export function transformPokemonData(data: any): CachePokemon {
  const stats = transformStats(data.stats);
  const types = data.types
    .sort((a: any, b: any) => a.slot - b.slot)
    .map((t: any) => t.type.name);

  return {
    id: data.id,
    name: formatName(data.name),
    nameJp: data.name,
    generation: getGenerationById(data.id),
    types: types as any[],
    spriteFront: data.sprites.front_default || '',
    spriteBack: data.sprites.back_default || '',
    spriteShinyFront: data.sprites.front_shiny || null,
    spriteShinyBack: data.sprites.back_shiny || null,
    stats,
    moves: [],
    height: data.height,
    weight: data.weight,
  };
}

/**
 * Transform stats from PokeAPI format
 */
function transformStats(statsData: any[]): CachePokemon['stats'] {
  const statMap: Record<string, number> = {};
  
  for (const stat of statsData) {
    statMap[stat.stat.name] = stat.base_stat;
  }

  return {
    hp: statMap['hp'] || 100,
    attack: statMap['attack'] || 100,
    defense: statMap['defense'] || 100,
    specialAttack: statMap['special-attack'] || 100,
    specialDefense: statMap['special-defense'] || 100,
    speed: statMap['speed'] || 100,
  };
}

/**
 * Format Pokemon name (remove hyphens, capitalize)
 */
export function formatName(name: string): string {
  return name
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Get generation number from Pokemon ID
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
 * Fetch and transform a Pokemon from PokeAPI
 */
export async function fetchAndTransformPokemon(id: number): Promise<CachePokemon | null> {
  try {
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
    if (!response.ok) return null;
    
    const data = await response.json();
    return transformPokemonData(data);
  } catch (error) {
    console.error(`Failed to fetch Pokemon ${id}:`, error);
    return null;
  }
}

/**
 * Seed Pokemon in batches with delay
 */
export async function seedPokemonBatch(
  ids: number[],
  onProgress?: (current: number, total: number) => void
): Promise<CachePokemon[]> {
  const results: CachePokemon[] = [];
  const total = ids.length;
  let current = 0;

  for (let i = 0; i < ids.length; i += DEFAULT_SEED_CONFIG.batchSize) {
    const batch = ids.slice(i, i + DEFAULT_SEED_CONFIG.batchSize);
    const batchResults = await Promise.all(
      batch.map(id => fetchAndTransformPokemon(id))
    );
    
    results.push(...batchResults.filter(Boolean) as CachePokemon[]);
    current += batch.length;
    onProgress?.(current, total);

    // Delay between batches to respect rate limits
    if (i + DEFAULT_SEED_CONFIG.batchSize < ids.length) {
      await new Promise(resolve => 
        setTimeout(resolve, DEFAULT_SEED_CONFIG.delayBetweenRequests)
      );
    }
  }

  return results;
}

/**
 * Seed generation data
 */
export async function seedGeneration(gen: number): Promise<CachePokemon[]> {
  const [minId, maxId] = getGenerationRange(gen);
  const ids = Array.from({ length: maxId - minId + 1 }, (_, i) => minId + i);
  return seedPokemonBatch(ids);
}

export default {
  getSeedList,
  getGenerationRange,
  transformPokemonData,
  formatName,
  getGenerationById,
  fetchAndTransformPokemon,
  seedPokemonBatch,
  seedGeneration,
};
