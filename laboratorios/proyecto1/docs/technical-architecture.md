# Sinnoh Edition - Technical Architecture

## Directory Structure

```
proyecto1/
├── apps/
│   ├── web/                 # Frontend (Preact + Vite)
│   │   ├── src/
│   │   │   ├── features/   # Screen components
│   │   │   ├── lib/        # Utilities and API clients
│   │   │   ├── styles/     # CSS files
│   │   │   ├── App.tsx     # Main app
│   │   │   └── main.tsx    # Entry point
│   │   └── package.json
│   │
│   └── api/                # Backend (Hono + Bun)
│       ├── src/
│       │   ├── routes/     # API endpoints
│       │   ├── services/   # Business logic
│       │   ├── database/   # SQLite schema and connection
│       │   └── index.ts    # Server entry
│       ├── data/           # SQLite database
│       └── package.json
│
├── packages/
│   ├── shared/             # Shared types and constants
│   │   └── src/
│   │       ├── types.ts    # TypeScript interfaces
│   │       └── constants.ts # Game constants
│   │
│   ├── battle-engine/       # Battle logic
│   │   └── src/
│   │       ├── battle-engine.ts
│   │       ├── turn-manager.ts
│   │       ├── damage-calculator.ts
│   │       ├── status-effects.ts
│   │       ├── switch-rules.ts
│   │       ├── random-move-selector.ts
│   │       └── win-condition.ts
│   │
│   └── pokemon-cache/      # Pokemon data utilities
│       └── src/
│           ├── cache-schema.ts
│           ├── seed-pokemon.ts
│           ├── generation-mapper.ts
│           └── sprite-resolver.ts
│
├── docs/                   # Documentation
└── package.json            # Root package
```

## Technology Stack

### Frontend
- **Framework:** Preact 10.x
- **Build Tool:** Vite 5.x
- **State Management:** Preact Signals
- **Language:** TypeScript 5.x

### Backend
- **Framework:** Hono 4.x
- **Runtime:** Bun 1.x
- **WebSocket:** ws 8.x
- **Database:** SQLite (bun:sqlite)
- **Validation:** Zod

## API Architecture

### HTTP Endpoints
```
GET  /health                           # Health check
GET  /api/pokemon/:id                  # Get Pokemon by ID
GET  /api/pokemon/search/:name        # Search Pokemon
GET  /api/pokemon/generation/:gen     # Get generation Pokemon
GET  /api/pokemon/:id/moves           # Get Pokemon moves
GET  /api/pokemon/generations/summary # Get all generations
GET  /api/cache/status                # Cache stats
GET  /api/cache/types                # Type effectiveness
POST /api/cache/clear                # Clear cache
```

### WebSocket Protocol
```typescript
// Client -> Server
{ type: 'register', payload: { playerId, name, gender, spriteUrl } }
{ type: 'create_room', payload: { playerId } }
{ type: 'join_room', payload: { playerId, code } }
{ type: 'ready', payload: { playerId } }
{ type: 'ban_pokemon', payload: { playerId, pokemonId } }
{ type: 'select_team', payload: { playerId, team } }
{ type: 'battle_action', payload: { playerId, action, data } }

// Server -> Client
{ type: 'registered', payload: { success, playerId } }
{ type: 'room_created', payload: { roomId, code, status } }
{ type: 'room_joined', payload: { roomId, code, status } }
{ type: 'opponent_joined', payload: { opponentId } }
{ type: 'player_ready', payload: { playerId } }
{ type: 'phase_change', payload: { phase } }
{ type: 'pokemon_banned', payload: { playerId, pokemonId } }
{ type: 'team_selected', payload: { playerId } }
{ type: 'battle_update', payload: { playerId, action, data } }
```

## Data Flow

```
Frontend -> HTTP/WebSocket -> API -> Cache Service -> PokéAPI
                                          |
                                          v
                                    SQLite Cache
```

## Ports
- API HTTP: 3000
- WebSocket: 3001
- Web Dev Server: 5173
