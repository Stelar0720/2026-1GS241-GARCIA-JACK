// Sinnoh Edition - Pokemon Cache Exports
export interface CachePokemon {
  id: number;
  name: string;
  generation: number;
  types: string[];
  spriteFront: string;
  spriteBack: string;
}

export interface CacheConfig {
  maxPokemonInCache: number;
  maxMovesPerPokemon: number;
  cacheTtlMs: number;
  rateLimitDelay: number;
}

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxPokemonInCache: 1025,
  maxMovesPerPokemon: 50,
  cacheTtlMs: 1000 * 60 * 60 * 24,
  rateLimitDelay: 100,
};

export function generatePokemonCacheKey(id: number): string {
  return `pokemon_${id}`;
}

export function generateGenerationCacheKey(gen: number): string {
  return `generation_${gen}`;
}