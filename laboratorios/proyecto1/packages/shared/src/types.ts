// Sinnoh Edition - Shared Types
// Pokemon World Championships

export type PokemonType = 
  | 'normal' | 'fire' | 'water' | 'electric' | 'grass' 
  | 'ice' | 'fighting' | 'poison' | 'ground' | 'flying'
  | 'psychic' | 'bug' | 'rock' | 'ghost' | 'dragon'
  | 'dark' | 'steel' | 'fairy';

export type StatusEffect = 
  | 'burned' | 'poisoned' | 'asleep' | 'paralyzed' 
  | 'frozen' | 'confused' | 'none';

export type Gender = 'male' | 'female' | 'other';

export type RoomStatus = 
  | 'waiting' 
  | 'champion_select' 
  | 'ban_phase' 
  | 'team_select' 
  | 'pre_battle_awards' 
  | 'coin_flip' 
  | 'battle' 
  | 'finished';

export type BattleAction = 'attack' | 'switch' | 'run';

export type GameMode = 'pvp' | 'testing';

export interface Player {
  id: string;
  name: string;
  gender: Gender;
  championSprite: string;
  roomId?: string;
  connected: boolean;
  ready: boolean;
}

export interface Champion {
  id: string;
  name: string;
  gender: Gender;
  spriteUrl: string;
}

export interface Move {
  id: number;
  name: string;
  type: PokemonType;
  power: number;
  accuracy: number;
  pp: number;
  maxPp: number;
}

export interface PokemonStats {
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
}

export interface BattlePokemon {
  id: number;
  name: string;
  nameJp?: string;
  types: PokemonType[];
  spriteFront: string;
  spriteBack: string;
  spriteShiny?: string;
  stats: PokemonStats;
  moves: Move[];
  currentHp: number;
  maxHp: number;
  status: StatusEffect;
  sleepTurns?: number;
  isActive: boolean;
  isFainted: boolean;
}

export interface Room {
  id: string;
  code: string;
  status: RoomStatus;
  players: [Player | null, Player | null];
  hostPlayerId: string;
  bannedPokemon: string[];
  player1Team: BattlePokemon[];
  player2Team: BattlePokemon[];
  currentTurn: string | null;
  turnNumber: number;
  winner: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface CachePokemon {
  id: number;
  name: string;
  nameJp: string;
  generation: number;
  types: PokemonType[];
  spriteFront: string;
  spriteBack: string;
  spriteShinyFront?: string;
  spriteShinyBack?: string;
  stats: PokemonStats;
  moves: Move[];
  height: number;
  weight: number;
}

export interface TypeEffectiveness {
  [targetType: string]: number;
}

export interface TypeChart {
  [attackType: string]: TypeEffectiveness;
}

export interface GenerationTrophy {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export interface BattleLogEntry {
  turn: number;
  actorId: string;
  action: BattleAction;
  sourcePokemon: number;
  targetPokemon: number;
  moveUsed?: Move;
  damageDealt?: number;
  statusApplied?: StatusEffect;
  effectiveness?: 'super-effective' | 'not-effective' | 'no-effect';
  logMessage: string;
  timestamp: number;
}

export interface GameConfig {
  TESTING_GOD_MODE: boolean;
  MAX_POKEMON_PER_TEAM: number;
  MIN_POKEMON_PER_TEAM: number;
  BAN_LIMIT_PER_PLAYER: number;
  TEAM_SELECTION_TIMEOUT: number;
  RANDOM_FILL_ENABLED: boolean;
}

export const GAME_CONFIG: GameConfig = {
  TESTING_GOD_MODE: false,
  MAX_POKEMON_PER_TEAM: 6,
  MIN_POKEMON_PER_TEAM: 1,
  BAN_LIMIT_PER_PLAYER: 3,
  TEAM_SELECTION_TIMEOUT: 60,
  RANDOM_FILL_ENABLED: true,
};

export const POKEAPI_BASE = 'https://pokeapi.co/api/v2';
export const POKEAPI_SPRITES = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';

export const GENERATIONS: { [key: number]: { name: string; minId: number; maxId: number } } = {
  1: { name: 'Kanto', minId: 1, maxId: 151 },
  2: { name: 'Johto', minId: 152, maxId: 251 },
  3: { name: 'Hoenn', minId: 252, maxId: 386 },
  4: { name: 'Sinnoh', minId: 387, maxId: 493 },
  5: { name: 'Teselia', minId: 494, maxId: 649 },
  6: { name: 'Kalos', minId: 650, maxId: 721 },
  7: { name: 'Alola', minId: 722, maxId: 809 },
  8: { name: 'Galar', minId: 810, maxId: 905 },
  9: { name: 'Paldea', minId: 906, maxId: 1025 },
};

export const TRAINER_SPRITES = {
  male: [
    'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainer/ Lucas.png',
    'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainer/Barry.png',
  ],
  female: [
    'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainer/ Lucas.png',
    'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainer/Barry.png',
  ],
  other: [
    'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainer/ Lucas.png',
  ],
};