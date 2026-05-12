# Sinnoh Edition - Presentation Notes

## Project Information
- **Name:** Sinnoh Edition: Pokemon World Championships
- **Type:** University Project - Educational Use Only
- **Course:** DSIX

## Features to Highlight

### 1. Multiplayer System
- Real-time WebSocket synchronization
- Room-based matchmaking
- Local network support

### 2. Game Mechanics
- Turn-based combat
- Status effects system
- Type effectiveness
- Random move selection

### 3. Technical Highlights
- Hono + Bun backend
- Preact + Vite frontend
- SQLite caching
- PokéAPI integration

### 4. Design
- Nintendo DS aesthetic
- Pixel art style
- Responsive layout

## Demo Scenarios

### Basic Demo
1. Open two browsers
2. Create room in one
3. Join with code in other
4. Play through battle

### Testing God Mode
1. Enable TESTING_GOD_MODE in shared/constants.ts
2. Use Arceus in team
3. Notice infinite stats indicator

### Sinnoh Trophy
1. Select only Gen 4 Pokemon
2. See special trophy message

## Questions to Anticipate

Q: Is this an official Pokemon game?
A: No, this is an educational university project, not affiliated with Nintendo or Game Freak.

Q: How does multiplayer work?
A: WebSocket connections between the API server and clients. Same network required.

Q: Why PokéAPI?
A: Free, comprehensive API for Pokemon data with no authentication required.

Q: Can I deploy this?
A: Yes, the API can be deployed anywhere Bun is supported.

## Key Files to Mention
- apps/api/src/index.ts - Server entry
- apps/web/src/App.tsx - Main app component
- packages/battle-engine/ - Combat logic
- packages/shared/ - Types and constants
