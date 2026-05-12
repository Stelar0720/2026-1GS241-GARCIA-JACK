// Sinnoh Edition - Cache Schema
// Defines the structure for cached Pokemon data in SQLite

export interface CacheSchema {
  pokemon: {
    id: number;
    name: string;
    name_jp: string;
    generation: number;
    types: string;
    sprite_front: string;
    sprite_back: string;
    sprite_shiny_front: string | null;
    sprite_shiny_back: string | null;
    height: number;
    weight: number;
    stats_hp: number;
    stats_attack: number;
    stats_defense: number;
    stats_special_attack: number;
    stats_special_defense: number;
    stats_speed: number;
    created_at: number;
    updated_at: number;
  };
}

/**
 * Get SQL for creating cache tables
 */
export function getCacheCreateSQL(): string[] {
  return [
    `CREATE TABLE IF NOT EXISTS cache_pokemon (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      name_jp TEXT,
      generation INTEGER NOT NULL,
      types TEXT NOT NULL,
      sprite_front TEXT,
      sprite_back TEXT,
      sprite_shiny_front TEXT,
      sprite_shiny_back TEXT,
      height INTEGER,
      weight INTEGER,
      stats_hp INTEGER DEFAULT 0,
      stats_attack INTEGER DEFAULT 0,
      stats_defense INTEGER DEFAULT 0,
      stats_special_attack INTEGER DEFAULT 0,
      stats_special_defense INTEGER DEFAULT 0,
      stats_speed INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_pokemon_name ON cache_pokemon(name)`,
    `CREATE INDEX IF NOT EXISTS idx_pokemon_generation ON cache_pokemon(generation)`,
  ];
}

export default { getCacheCreateSQL };
