// Sinnoh Edition - Pokémon Cache Service
import type { CachePokemon, Move, PokemonStats, PokemonType } from '../../../../packages/shared/src/types.js';

interface PokeAPIResponse {
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
  moves: { move: { url: string } }[];
}

interface PokeAPIMoveResponse {
  id: number;
  name: string;
  type: { name: string };
  power: number | null;
  accuracy: number | null;
  pp: number | null;
}

class PokeAPICache {
  private cache: Map<number, CachePokemon> = new Map();
  private generationCache: Map<number, number[]> = new Map();
  private typeCache: Map<string, TypeEffectiveness> = new Map();
  private initialized: boolean = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    console.log('📦 Initializing PokéAPI Cache...');
    this.initialized = true;
  }

  async getPokemon(id: number): Promise<CachePokemon | null> {
    // Check cache first
    if (this.cache.has(id)) {
      return this.cache.get(id)!;
    }

    try {
      const response = await fetch(`${API_BASE}/pokemon/${id}`);
      if (!response.ok) return null;

      const data = await response.json() as PokeAPIResponse;
      const pokemon = this.transformPokemonData(data);

      this.cache.set(id, pokemon);
      return pokemon;
    } catch (error) {
      console.error(`Failed to fetch pokemon ${id}:`, error);
      return null;
    }
  }

  async getPokemonWithMoves(id: number): Promise<CachePokemon | null> {
    const pokemon = await this.getPokemon(id);
    if (pokemon && pokemon.moves.length === 0) {
      pokemon.moves = await this.getMovesForPokemon(id);
    }
    return pokemon;
  }

  async getPokemonByName(name: string): Promise<CachePokemon | null> {
    // Simple cache search by name
    for (const [, pokemon] of this.cache) {
      if (pokemon.name.toLowerCase() === name.toLowerCase()) {
        return pokemon;
      }
    }

    try {
      const response = await fetch(`${API_BASE}/pokemon/${name.toLowerCase()}`);
      if (!response.ok) return null;

      const data = await response.json() as PokeAPIResponse;
      const pokemon = this.transformPokemonData(data);

      this.cache.set(pokemon.id, pokemon);
      return pokemon;
    } catch (error) {
      console.error(`Failed to fetch pokemon ${name}:`, error);
      return null;
    }
  }

  async getMovesForPokemon(pokemonId: number): Promise<Move[]> {
    try {
      // Get detailed pokemon data for moves
      const response = await fetch(`${API_BASE}/pokemon/${pokemonId}`);
      if (!response.ok) return [];

      const data = await response.json() as { moves: { move: { url: string } }[] };
      const moves: Move[] = [];

      // Limit moves for performance (4 moves per type for variety)
      const moveMap = new Map<string, Move>();
      const maxMovesPerType = Math.ceil(CACHE_CONFIG.MAX_MOVES_PER_POKEMON / 10);
      
      for (const moveRef of data.moves) {
        if (moveMap.size >= CACHE_CONFIG.MAX_MOVES_PER_POKEMON) break;
        
        try {
          const moveResponse = await fetch(moveRef.move.url);
          if (moveResponse.ok) {
            const moveData: PokeAPIMoveResponse = await moveResponse.json();
            
            // Only add one move per type for variety, prefer higher power
            const existing = moveMap.get(moveData.type.name);
            if (!existing || (moveData.power && moveData.power > (existing.power || 0))) {
              moveMap.set(moveData.type.name, {
                id: moveData.id,
                name: this.formatMoveName(moveData.name),
                type: moveData.type.name as PokemonType,
                power: moveData.power ?? 0,
                accuracy: moveData.accuracy ?? 100,
                pp: moveData.pp ?? 20,
                maxPp: moveData.pp ?? 20,
              });
            }
          }
        } catch {
          continue;
        }
      }

      return Array.from(moveMap.values());
    } catch (error) {
      console.error(`Failed to fetch moves for pokemon ${pokemonId}:`, error);
      return [];
    }
  }

  async getGenerationPokemons(generationId: number): Promise<number[]> {
    if (this.generationCache.has(generationId)) {
      return this.generationCache.get(generationId)!;
    }

    try {
      const response = await fetch(`${API_BASE}/generation/${generationId}`);
      if (!response.ok) return [];

      const data = await response.json() as { pokemon_species?: { url: string }[] };
      const pokemonUrls = data.pokemon_species || [];
      const ids = pokemonUrls.map(({ url }) => {
        const parts = url.split('/').filter(Boolean);
        return parseInt(parts[parts.length - 1]);
      });

      this.generationCache.set(generationId, ids);
      return ids;
    } catch (error) {
      console.error(`Failed to fetch generation ${generationId}:`, error);
      return [];
    }
  }

  async getTypeChart(): Promise<TypeEffectiveness | null> {
    try {
      const response = await fetch(`${API_BASE}/type`);
      if (!response.ok) return null;

      const data = await response.json() as { results: TypeEffectiveness };
      return data.results as TypeEffectiveness;
    } catch (error) {
      console.error('Failed to fetch type chart:', error);
      return null;
    }
  }

  getCacheStats(): { size: number; generationCacheSize: number } {
    return {
      size: this.cache.size,
      generationCacheSize: this.generationCache.size,
    };
  }

  clearCache(): void {
    this.cache.clear();
    this.generationCache.clear();
    console.log('🗑️ Cache cleared');
  }

  private transformPokemonData(data: PokeAPIResponse): CachePokemon {
    const stats = this.transformStats(data.stats);
    
    return {
      id: data.id,
      name: this.formatPokemonName(data.name),
      nameJp: data.name,
      generation: this.getGenerationById(data.id),
      types: data.types
        .sort((a, b) => a.slot - b.slot)
        .map(t => t.type.name as PokemonType),
      spriteFront: data.sprites.front_default || '',
      spriteBack: data.sprites.back_default || '',
      spriteShinyFront: data.sprites.front_shiny || '',
      spriteShinyBack: data.sprites.back_shiny || '',
      stats,
      moves: [],
      height: data.height,
      weight: data.weight,
    };
  }

  private transformStats(statsData: { base_stat: number; stat: { name: string } }[]): PokemonStats {
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

  private formatPokemonName(name: string): string {
    return name
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private formatMoveName(name: string): string {
    return name
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private getGenerationById(id: number): number {
    const generationRanges = [
      { gen: 1, max: 151 },
      { gen: 2, max: 251 },
      { gen: 3, max: 386 },
      { gen: 4, max: 493 },
      { gen: 5, max: 649 },
      { gen: 6, max: 721 },
      { gen: 7, max: 809 },
      { gen: 8, max: 905 },
      { gen: 9, max: 1025 },
    ];

    for (const range of generationRanges) {
      if (id <= range.max) return range.gen;
    }
    return 9;
  }
}

interface TypeEffectiveness {
  [key: string]: string;
}

export const CACHE_CONFIG = {
  MAX_POKEMON_IN_CACHE: 1025,
  MAX_MOVES_PER_POKEMON: 50,
  CACHE_TTL_MS: 1000 * 60 * 60 * 24,
  RATE_LIMIT_DELAY: 100,
};

export const API_BASE = 'https://pokeapi.co/api/v2';

export const pokeAPICache = new PokeAPICache();
export default pokeAPICache;
