# Sinnoh Edition - UI Flow

## Screen Flow Diagram

```
┌─────────────────┐
│ Champion Select │
└────────┬────────┘
         │
         v
┌─────────────────┐
│     Lobby       │◄─────────────────┐
└────────┬────────┘                  │
         │                           │
    ┌────┴────┐                      │
    │         │                      │
    v         v                      │
┌─────────┐ ┌─────────┐             │
│Create   │ │Join     │             │
│Room     │ │Room     │             │
└────┬────┘ └───┬─────┘             │
     │          │                   │
     └─────┬────┘                   │
           │                         │
           v                         │
┌──────────────────────┐              │
│   Both Players      │              │
│   Ready?            │──────────────┤
└──────────┬──────────┘              │
           │                         │
           v                         │
┌──────────────────────┐              │
│     Ban Phase       │──────────────┘
└──────────┬──────────┘
           │
           v
┌──────────────────────┐
│   Team Selection    │──────────────┘
└──────────┬──────────┘
           │
           v
┌──────────────────────┐
│  Pre-Battle Awards  │──────────────┘
└──────────┬──────────┘
           │
           v
┌──────────────────────┐
│     Coin Flip       │──────────────┘
└──────────┬──────────┘
           │
           v
┌──────────────────────┐
│      Battle         │──────────────┘
└──────────┬──────────┘
           │
           v
┌──────────────────────┐
│      Results         │──────────────┘
└──────────────────────┘
```

## Screen Descriptions

### 1. Champion Select
- Input: Player name (2-12 chars)
- Select: Gender (male/female/other)
- Display: Trainer sprite preview
- Action: Confirm to save and continue

### 2. Lobby
- Create Room: Generate 6-char code
- Join Room: Enter code to join
- Display: Room code, player sprites
- Status: Connected/Disconnected indicator
- Ready button when opponent present

### 3. Ban Phase
- Display: Grid of Pokemon
- Bans: 3 per player (6 total)
- Visual: Banned Pokemon marked
- Auto-advance when both complete

### 4. Team Selection
- Timer: 60 seconds countdown
- Selection: Click to add/remove
- Random Fill: Option button
- Ready: Confirm team button
- Minimum: 1 Pokemon

### 5. Pre-Battle Awards
- Trigger: All Pokemon same generation
- Special: Sinnoh trophy message
- Duration: 10 seconds
- Auto-advance to coin flip

### 6. Coin Flip
- Animation: Spinning coin
- Result: Heads/Tails randomly
- Winner: First turn assignment
- Auto-advance to battle

### 7. Battle
- HP Bars: For both active Pokemon
- Move Menu: 4 move buttons
- Switch Menu: Team Pokemon list
- Log: Recent actions display
- Status: Whose turn indicator

### 8. Results
- Winner: Display name
- Summary: Pokemon fainted
- Actions: Play Again, Return to Lobby
