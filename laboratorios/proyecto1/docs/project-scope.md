# Sinnoh Edition - Project Scope

## Overview
**Project Name:** Sinnoh Edition: Pokemon World Championships  
**Type:** Multiplayer Pokemon Battle Game  
**Target:** University project for educational purposes

## Game Flow

### 1. Champion Select
- Player enters their name
- Selects gender (male/female/other)
- Sprite selection based on gender
- Data saved to localStorage

### 2. Lobby / Room System
- Create room with unique 6-character code
- Join room using code
- Two players maximum per room
- WebSocket synchronization
- Ready status indicator

### 3. Ban Phase
- Each player can ban 3 Pokemon (6 total)
- Banned Pokemon cannot be selected
- Real-time sync between players

### 4. Team Selection
- Select 1-6 Pokemon for team
- 60-second timer
- Random fill option
- Auto-fill with random Pokemon if timer expires
- Each Pokemon gets 4 random moves

### 5. Pre-Battle Awards
- Display trophy if team is from single generation
- Special message for Sinnoh (Gen 4) teams
- 10-second display duration

### 6. Coin Flip
- Random coin toss animation
- Determines who goes first
- Pixel art coin with Sinnoh theme

### 7. Battle
- Turn-based combat
- Actions: Attack, Switch, Surrender
- Switching consumes turn
- Status effects: Burn, Poison, Sleep, Paralysis, Freeze, Confusion
- No items, weather, hazards
- Win by defeating all opponent Pokemon

### 8. Results
- Display winner
- Battle summary
- Option to play again

## Technical Requirements

### Frontend
- Preact + Vite
- TypeScript
- Pixel art aesthetic (Nintendo DS style)
- Responsive design

### Backend
- Hono framework
- Bun runtime
- WebSocket for multiplayer
- SQLite for persistence

### External APIs
- PokéAPI for Pokemon data
- Cache layer for performance

## Multiplayer Support
- Same PC (different browsers)
- Same PC (incognito mode)
- Different laptops on same network
- Mobile devices via local IP
