# Sinnoh Edition - Cache Strategy

## Overview
PokéAPI data is cached to reduce external API calls and improve performance.

## Cache Architecture

```
Request Flow:
Frontend -> Backend (API) -> Cache Service -> PokéAPI
                                |
                                v
                          SQLite Database
```

## What Gets Cached

### Pokemon Data
- id
- name
- nameJp
- generation
- types
- spriteFront
- spriteBack
- spriteShinyFront
- spriteShinyBack
- stats (hp, attack, defense, specialAttack, specialDefense, speed)
- height
- weight

### Moves Data
- id
- name
- type
- power
- accuracy
- pp

### Generation Data
- id
- name
- minId
- maxId

## Cache Tables

```sql
-- Pokemon cache
CREATE TABLE IF NOT EXISTS cache_pokemon (
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
  created_at INTEGER,
  updated_at INTEGER
);

-- Indexes
CREATE INDEX idx_pokemon_name ON cache_pokemon(name);
CREATE INDEX idx_pokemon_generation ON cache_pokemon(generation);
```

## Cache Policy

### TTL (Time to Live)
- Default: 24 hours
- Configurable via CACHE_TTL_MS

### Rate Limiting
- 100ms delay between requests
- Configurable via RATE_LIMIT_DELAY

### Cache Invalidation
- Manual clear via /api/cache/clear endpoint
- Automatic on TTL expiry

## API Endpoints

### GET /api/cache/status
Returns cache statistics.

### GET /api/cache/types
Returns type effectiveness chart.

### POST /api/cache/clear
Clears all cached data.

### POST /api/cache/seed/:gen
Seeds a generation into cache.

## Benefits
1. Reduced PokéAPI calls
2. Faster response times
3. Offline capability for cached data
4. Rate limit compliance
