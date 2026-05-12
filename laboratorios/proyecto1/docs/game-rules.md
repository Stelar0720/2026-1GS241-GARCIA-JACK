# Sinnoh Edition - Game Rules

## Core Rules

### Team Composition
- Minimum: 1 Pokemon
- Maximum: 6 Pokemon
- Each Pokemon has 4 moves

### Battle Mechanics
- Turn-based combat
- Turn order determined by speed stat
- Switching Pokemon consumes turn
- No items allowed
- No weather effects
- No hazards (spikes, stealth rocks, etc.)

### Status Effects
| Status | Effect | Damage |
|--------|--------|--------|
| Burned | -50% Attack, -6.25% HP/turn | Yes |
| Poisoned | -12.5% HP/turn | Yes |
| Asleep | Cannot act (2-4 turns) | No |
| Paralyzed | 25% full paralysis, -50% Speed | No |
| Frozen | Cannot act (random wake) | No |
| Confused | 33% self-hit | Yes |

### Damage Calculation
```
Level = 50
BaseDamage = ((2 * Level / 5 + 2) * Power * Attack / Defense / 50 + 2)
STAB = 1.5 if same type move
TypeMultiplier = from type chart
RandomFactor = 0.85-1.0
CriticalHit = 6.25% chance, 1.5x damage

FinalDamage = BaseDamage * STAB * TypeMultiplier * RandomFactor * CriticalMultiplier
```

### Win Condition
- Defeat all opponent Pokemon
- Opponent surrenders
- All Pokemon fainted = loss

### Generation Trophy Rules
- Team must be 100% from single generation
- Special trophy for Sinnoh (Gen 4) teams
- Message: "Campeon de Cultura"

## God Mode (Arceus)
When TESTING_GOD_MODE is enabled:
- Arceus has infinite HP
- Arceus has infinite Attack
- Special message displayed

## Bans
- 3 bans per player (6 total)
- Banned Pokemon cannot be selected
- Ban phase must complete before team selection
