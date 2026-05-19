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
// CONFIG - Dynamic API URL based on environment
// ============================================

function getApiUrl(): string {
  // If deployed, use the deployed API URL, otherwise use localhost
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    // For deployed versions, assume API is also deployed or use relative path
    return `http://localhost:3000/api`;
  }
  return 'http://localhost:3000/api';
}

export const CONFIG = {
  API_URL: getApiUrl(),
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
// IN-MEMORY CACHE for Pokemon data (frontend-side)
// ============================================

const CACHE_EXPIRY = 1000 * 60 * 30; // 30 minutes cache

interface CacheEntry {
  data: any;
  timestamp: number;
}

const cacheStore = new Map<number, CacheEntry>();

export function getCachedPokemon(id: number): any | null {
  const entry = cacheStore.get(id);
  if (entry && Date.now() - entry.timestamp < CACHE_EXPIRY) {
    return entry.data;
  }
  return null;
}

export function setCachedPokemon(id: number, data: any): void {
  cacheStore.set(id, { data, timestamp: Date.now() });
}

export function clearPokemonCache(): void {
  cacheStore.clear();
}

// ============================================
// API CLIENT with caching
// ============================================

export async function fetchPokemon(id: number): Promise<any> {
  // Check cache first
  const cached = getCachedPokemon(id);
  if (cached) {
    return cached;
  }

  const res = await fetch(`${CONFIG.API_URL}/pokemon/${id}`);
  if (!res.ok) throw new Error('Pokemon not found');
  const data = await res.json();
  
  // Cache the result
  setCachedPokemon(id, data);
  
  return data;
}

export async function fetchGenerationPokemons(gen: number): Promise<any> {
  const res = await fetch(`${CONFIG.API_URL}/pokemon/generation/${gen}`);
  if (!res.ok) throw new Error('Generation not found');
  return res.json();
}

export async function fetchPokemonMoves(id: number): Promise<any> {
  const res = await fetch(`${CONFIG.API_URL}/pokemon/${id}/moves`);
  if (!res.ok) throw new Error('Moves not found');
  return res.json();
}

export async function searchPokemon(name: string): Promise<any> {
  const res = await fetch(`${CONFIG.API_URL}/pokemon/search/${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error('Pokemon not found');
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
  const base = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
  return shiny ? `${base}/shiny/${id}.png` : `${base}/${id}.png`;
}

export function getPokemonBackSprite(id: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/${id}.png`;
}

// ============================================
// TRAINER SPRITES - Using SVG Data URIs (universal, no external deps)
// ============================================

// Simple pixel-art style trainer SVGs encoded as data URIs
const TRAINER_SVGS = {
  kanto: {
    male: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
      <rect fill="#dc0a2d" x="0" y="0" width="96" height="96"/>
      <circle fill="#ffcc99" cx="48" cy="35" r="20"/>
      <rect fill="#303c9c" x="28" y="50" width="40" height="35" rx="5"/>
      <rect fill="#e8a838" x="18" y="85" width="15" height="11"/>
      <rect fill="#e8a838" x="63" y="85" width="15" height="11"/>
      <rect fill="#303c9c" x="25" y="55" width="10" height="20"/>
      <rect fill="#303c9c" x="61" y="55" width="10" height="20"/>
    </svg>`,
    female: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
      <rect fill="#dc0a2d" x="0" y="0" width="96" height="96"/>
      <circle fill="#ffcc99" cx="48" cy="35" r="20"/>
      <rect fill="#c03030" x="28" y="50" width="40" height="35" rx="5"/>
      <rect fill="#e8a838" x="18" y="85" width="15" height="11"/>
      <rect fill="#e8a838" x="63" y="85" width="15" height="11"/>
      <rect fill="#c03030" x="25" y="55" width="10" height="20"/>
      <rect fill="#c03030" x="61" y="55" width="10" height="20"/>
    </svg>`,
    other: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
      <rect fill="#dc0a2d" x="0" y="0" width="96" height="96"/>
      <circle fill="#ffcc99" cx="48" cy="35" r="20"/>
      <rect fill="#606060" x="28" y="50" width="40" height="35" rx="5"/>
      <rect fill="#e8a838" x="18" y="85" width="15" height="11"/>
      <rect fill="#e8a838" x="63" y="85" width="15" height="11"/>
      <rect fill="#606060" x="25" y="55" width="10" height="20"/>
      <rect fill="#606060" x="61" y="55" width="10" height="20"/>
    </svg>`,
  },
  sinnoh: {
    male: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
      <rect fill="#b8c8d8" x="0" y="0" width="96" height="96"/>
      <circle fill="#ffcc99" cx="48" cy="35" r="20"/>
      <rect fill="#1a1a3e" x="28" y="50" width="40" height="35" rx="5"/>
      <rect fill="#4a4a8a" x="18" y="85" width="15" height="11"/>
      <rect fill="#4a4a8a" x="63" y="85" width="15" height="11"/>
      <rect fill="#e0c030" x="32" y="55" width="32" height="5"/>
    </svg>`,
    female: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
      <rect fill="#b8c8d8" x="0" y="0" width="96" height="96"/>
      <circle fill="#ffcc99" cx="48" cy="35" r="20"/>
      <rect fill="#c03050" x="28" y="50" width="40" height="35" rx="5"/>
      <rect fill="#4a4a8a" x="18" y="85" width="15" height="11"/>
      <rect fill="#4a4a8a" x="63" y="85" width="15" height="11"/>
      <rect fill="#e0c030" x="32" y="55" width="32" height="5"/>
    </svg>`,
    other: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
      <rect fill="#b8c8d8" x="0" y="0" width="96" height="96"/>
      <circle fill="#ffcc99" cx="48" cy="35" r="20"/>
      <rect fill="#303060" x="28" y="50" width="40" height="35" rx="5"/>
      <rect fill="#4a4a8a" x="18" y="85" width="15" height="11"/>
      <rect fill="#4a4a8a" x="63" y="85" width="15" height="11"/>
    </svg>`,
  },
  johto: {
    male: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
      <rect fill="#c8a028" x="0" y="0" width="96" height="96"/>
      <circle fill="#ffcc99" cx="48" cy="35" r="20"/>
      <rect fill="#606060" x="28" y="50" width="40" height="35" rx="5"/>
      <rect fill="#303030" x="18" y="85" width="15" height="11"/>
      <rect fill="#303030" x="63" y="85" width="15" height="11"/>
    </svg>`,
    female: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
      <rect fill="#c8a028" x="0" y="0" width="96" height="96"/>
      <circle fill="#ffcc99" cx="48" cy="35" r="20"/>
      <rect fill="#c03030" x="28" y="50" width="40" height="35" rx="5"/>
      <rect fill="#303030" x="18" y="85" width="15" height="11"/>
      <rect fill="#303030" x="63" y="85" width="15" height="11"/>
    </svg>`,
    other: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
      <rect fill="#c8a028" x="0" y="0" width="96" height="96"/>
      <circle fill="#ffcc99" cx="48" cy="35" r="20"/>
      <rect fill="#404040" x="28" y="50" width="40" height="35" rx="5"/>
      <rect fill="#303030" x="18" y="85" width="15" height="11"/>
      <rect fill="#303030" x="63" y="85" width="15" height="11"/>
    </svg>`,
  },
  hoenn: {
    male: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
      <rect fill="#e8b038" x="0" y="0" width="96" height="96"/>
      <circle fill="#ffcc99" cx="48" cy="35" r="20"/>
      <rect fill="#00a8e8" x="28" y="50" width="40" height="35" rx="5"/>
      <rect fill="#e8a838" x="18" y="85" width="15" height="11"/>
      <rect fill="#e8a838" x="63" y="85" width="15" height="11"/>
    </svg>`,
    female: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
      <rect fill="#e8b038" x="0" y="0" width="96" height="96"/>
      <circle fill="#ffcc99" cx="48" cy="35" r="20"/>
      <rect fill="#c03030" x="28" y="50" width="40" height="35" rx="5"/>
      <rect fill="#e8a838" x="18" y="85" width="15" height="11"/>
      <rect fill="#e8a838" x="63" y="85" width="15" height="11"/>
    </svg>`,
    other: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
      <rect fill="#e8b038" x="0" y="0" width="96" height="96"/>
      <circle fill="#ffcc99" cx="48" cy="35" r="20"/>
      <rect fill="#507080" x="28" y="50" width="40" height="35" rx="5"/>
      <rect fill="#e8a838" x="18" y="85" width="15" height="11"/>
      <rect fill="#e8a838" x="63" y="85" width="15" height="11"/>
    </svg>`,
  },
  teselia: {
    male: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
      <rect fill="#303c60" x="0" y="0" width="96" height="96"/>
      <circle fill="#ffcc99" cx="48" cy="35" r="20"/>
      <rect fill="#1a1a2e" x="28" y="50" width="40" height="35" rx="5"/>
      <rect fill="#606080" x="18" y="85" width="15" height="11"/>
      <rect fill="#606080" x="63" y="85" width="15" height="11"/>
    </svg>`,
    female: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
      <rect fill="#303c60" x="0" y="0" width="96" height="96"/>
      <circle fill="#ffcc99" cx="48" cy="35" r="20"/>
      <rect fill="#c03050" x="28" y="50" width="40" height="35" rx="5"/>
      <rect fill="#606080" x="18" y="85" width="15" height="11"/>
      <rect fill="#606080" x="63" y="85" width="15" height="11"/>
    </svg>`,
    other: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
      <rect fill="#303c60" x="0" y="0" width="96" height="96"/>
      <circle fill="#ffcc99" cx="48" cy="35" r="20"/>
      <rect fill="#404050" x="28" y="50" width="40" height="35" rx="5"/>
      <rect fill="#606080" x="18" y="85" width="15" height="11"/>
      <rect fill="#606080" x="63" y="85" width="15" height="11"/>
    </svg>`,
  },
  kalos: {
    male: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
      <rect fill="#a8b8e8" x="0" y="0" width="96" height="96"/>
      <circle fill="#ffcc99" cx="48" cy="35" r="20"/>
      <rect fill="#f8f8f8" x="28" y="50" width="40" height="35" rx="5"/>
      <rect fill="#e8a838" x="18" y="85" width="15" height="11"/>
      <rect fill="#e8a838" x="63" y="85" width="15" height="11"/>
    </svg>`,
    female: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
      <rect fill="#a8b8e8" x="0" y="0" width="96" height="96"/>
      <circle fill="#ffcc99" cx="48" cy="35" r="20"/>
      <rect fill="#f06080" x="28" y="50" width="40" height="35" rx="5"/>
      <rect fill="#e8a838" x="18" y="85" width="15" height="11"/>
      <rect fill="#e8a838" x="63" y="85" width="15" height="11"/>
    </svg>`,
    other: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
      <rect fill="#a8b8e8" x="0" y="0" width="96" height="96"/>
      <circle fill="#ffcc99" cx="48" cy="35" r="20"/>
      <rect fill="#808090" x="28" y="50" width="40" height="35" rx="5"/>
      <rect fill="#e8a838" x="18" y="85" width="15" height="11"/>
      <rect fill="#e8a838" x="63" y="85" width="15" height="11"/>
    </svg>`,
  },
};

export const REGIONS = [
  { id: 'kanto', name: 'Kanto', color: '#dc0a2d' },
  { id: 'johto', name: 'Johto', color: '#c8a028' },
  { id: 'hoenn', name: 'Hoenn', color: '#e8b038' },
  { id: 'sinnoh', name: 'Sinnoh', color: '#b8c8d8' },
  { id: 'teselia', name: 'Teselia', color: '#303c60' },
  { id: 'kalos', name: 'Kalos', color: '#a8b8e8' },
];

export function getTrainerSprite(gender: 'male' | 'female' | 'other', region: string = 'sinnoh'): string {
  const regionData = TRAINER_SVGS[region as keyof typeof TRAINER_SVGS] || TRAINER_SVGS.sinnoh;
  const sprite = regionData[gender] || regionData.other;
  
  // Convert SVG to data URI
  return `data:image/svg+xml,${encodeURIComponent(sprite)}`;
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
