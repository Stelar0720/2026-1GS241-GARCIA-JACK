// Sinnoh Edition - Web Frontend Entry
import { signal, computed } from '@preact/signals';

// ============================================
// STATE MANAGEMENT (Preact Signals)
// ============================================

export interface GameState {
  screen: 'champion-select' | 'lobby' | 'ban' | 'team-select' | 'battle' | 'results';
  player: {
    id: string;
    name: string;
    gender: 'male' | 'female' | 'other';
    spriteUrl: string;
  } | null;
  room: {
    id: string;
    code: string;
    opponent: string | null;
    status: string;
  } | null;
  battle: {
    team: any[];
    opponentTeam: any[];
    currentTurn: string | null;
  } | null;
}

export const gameState = signal<GameState>({
  screen: 'champion-select',
  player: null,
  room: null,
  battle: null,
});

export const roomStatus = computed(() => gameState.value.room?.status || 'disconnected');
export const currentScreen = computed(() => gameState.value.screen);

// ============================================
// CONFIG
// ============================================

export const CONFIG = {
  API_URL: 'http://localhost:3000/api',
  GAME_CONFIG: {
    MAX_POKEMON: 6,
    MIN_POKEMON: 1,
    BAN_LIMIT: 3,
    TEAM_TIMEOUT: 60,
    RANDOM_FILL: true,
    TESTING_GOD_MODE: false,
  },
  POKEMON_LIMIT: 1025,
  GENERATIONS: [
    { id: 1, name: 'Kanto', min: 1, max: 151 },
    { id: 2, name: 'Johto', min: 152, max: 251 },
    { id: 3, name: 'Hoenn', min: 252, max: 386 },
    { id: 4, name: 'Sinnoh', min: 387, max: 493 },
    { id: 5, name: 'Teselia', min: 494, max: 649 },
    { id: 6, name: 'Kalos', min: 650, max: 721 },
    { id: 7, name: 'Alola', min: 722, max: 809 },
    { id: 8, name: 'Galar', min: 810, max: 905 },
    { id: 9, name: 'Paldea', min: 906, max: 1025 },
  ],
};

// ============================================
// API CLIENT
// ============================================

export async function fetchPokemon(id: number) {
  const res = await fetch(`${CONFIG.API_URL}/pokemon/${id}`);
  if (!res.ok) throw new Error('Pokemon not found');
  return res.json();
}

export async function fetchGenerationPokemons(gen: number) {
  const res = await fetch(`${CONFIG.API_URL}/pokemon/generation/${gen}`);
  if (!res.ok) throw new Error('Generation not found');
  return res.json();
}

export async function fetchPokemonMoves(id: number) {
  const res = await fetch(`${CONFIG.API_URL}/pokemon/${id}/moves`);
  if (!res.ok) throw new Error('Moves not found');
  return res.json();
}

export async function createRoom(playerId: string) {
  const res = await fetch(`${CONFIG.API_URL}/rooms/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId }),
  });
  return res.json();
}

export async function joinRoom(code: string, playerId: string) {
  const res = await fetch(`${CONFIG.API_URL}/rooms/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, playerId }),
  });
  return res.json();
}

export async function banPokemon(roomId: string, pokemonId: string) {
  const res = await fetch(`${CONFIG.API_URL}/rooms/${roomId}/ban`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pokemonId }),
  });
  return res.json();
}

// ============================================
// SPRITE UTILITIES
// ============================================

export function getPokemonSprite(id: number, shiny = false): string {
  const base = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon`;
  return shiny ? `${base}/shiny/${id}.png` : `${base}/${id}.png`;
}

export function getPokemonBackSprite(id: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/${id}.png`;
}

export function getTrainerSprite(gender: 'male' | 'female' | 'other', index: number = 0): string {
  // Placeholder trainer sprites
  const sprites = {
    male: [`trainer-lucas.png`, `trainer-barry.png`],
    female: [`trainer-lucas.png`, `trainer-barry.png`],
    other: [`trainer-lucas.png`],
  };
  const sprite = (sprites[gender] || sprites.other)[index] || sprites.other[0];
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainer/${sprite}`;
}

// ============================================
// GAME UTILITIES
// ============================================

export function generatePlayerId(): string {
  return `player_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function selectRandomMoves(moves: any[], count = 4): any[] {
  return shuffleArray(moves).slice(0, Math.min(count, moves.length));
}

export function checkGenerationTrophy(team: any[], targetGen: number): boolean {
  if (team.length === 0) return false;
  return team.every(p => p.generation === targetGen);
}

export const GENERATION_TROPHIES = [
  { gen: 1, name: 'Campeón de Kanto', icon: '🏆' },
  { gen: 2, name: 'Campeón de Johto', icon: '🏆' },
  { gen: 3, name: 'Campeón de Hoenn', icon: '🏆' },
  { gen: 4, name: 'Campeón de Sinnoh', icon: '🏆', special: true },
];

export function getTrophyMessage(team: any[], playerName: string): string | null {
  for (const trophy of GENERATION_TROPHIES) {
    if (checkGenerationTrophy(team, trophy.gen)) {
      if (trophy.special) {
        return `${trophy.icon} Campeón de Cultura\nHas elegido el camino correcto. Sinnoh aprueba tu equipo.`;
      }
      return `${trophy.icon} ${playerName} - ${trophy.name}`;
    }
  }
  return null;
}

// ============================================
// STORAGE (Local for MVP)
// ============================================

export function saveLocalStorage(key: string, value: any): void {
  localStorage.setItem(`sinnoh_${key}`, JSON.stringify(value));
}

export function loadLocalStorage<T>(key: string, defaultValue: T): T {
  const stored = localStorage.getItem(`sinnoh_${key}`);
  if (!stored) return defaultValue;
  try {
    return JSON.parse(stored) as T;
  } catch {
    return defaultValue;
  }
}

export function clearLocalStorage(): void {
  const keys = Object.keys(localStorage).filter(k => k.startsWith('sinnoh_'));
  keys.forEach(k => localStorage.removeItem(k));
}