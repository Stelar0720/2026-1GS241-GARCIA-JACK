// Sinnoh Edition - Generation Mapper
// Maps Pokemon to their generations and vice versa

export interface GenerationInfo {
  id: number;
  name: string;
  displayName: string;
  minId: number;
  maxId: number;
  color: string;
  icon: string;
}

export const GENERATIONS: GenerationInfo[] = [
  {
    id: 1,
    name: 'kanto',
    displayName: 'Kanto',
    minId: 1,
    maxId: 151,
    color: '#ff0000',
    icon: '🔴',
  },
  {
    id: 2,
    name: 'johto',
    displayName: 'Johto',
    minId: 152,
    maxId: 251,
    color: '#ffa500',
    icon: '🟠',
  },
  {
    id: 3,
    name: 'hoenn',
    displayName: 'Hoenn',
    minId: 252,
    maxId: 386,
    color: '#ffff00',
    icon: '🟡',
  },
  {
    id: 4,
    name: 'sinnoh',
    displayName: 'Sinnoh',
    minId: 387,
    maxId: 493,
    color: '#00a0e9',
    icon: '🔵',
  },
  {
    id: 5,
    name: 'teselia',
    displayName: 'Teselia',
    minId: 494,
    maxId: 649,
    color: '#00ff00',
    icon: '🟢',
  },
  {
    id: 6,
    name: 'kalos',
    displayName: 'Kalos',
    minId: 650,
    maxId: 721,
    color: '#9d00ff',
    icon: '🟣',
  },
  {
    id: 7,
    name: 'alola',
    displayName: 'Alola',
    minId: 722,
    maxId: 809,
    color: '#ff69b4',
    icon: '🎀',
  },
  {
    id: 8,
    name: 'galar',
    displayName: 'Galar',
    minId: 810,
    maxId: 905,
    color: '#8b4513',
    icon: '🟤',
  },
  {
    id: 9,
    name: 'paldea',
    displayName: 'Paldea',
    minId: 906,
    maxId: 1025,
    color: '#ffd700',
    icon: '⭐',
  },
];

/**
 * Get generation info by ID
 */
export function getGenerationById(id: number): GenerationInfo | null {
  return GENERATIONS.find(gen => id >= gen.minId && id <= gen.maxId) || null;
}

/**
 * Get generation info by generation number
 */
export function getGenerationByNumber(gen: number): GenerationInfo | null {
  return GENERATIONS.find(g => g.id === gen) || null;
}

/**
 * Check if a Pokemon ID belongs to a specific generation
 */
export function isInGeneration(pokemonId: number, gen: number): boolean {
  const generation = getGenerationByNumber(gen);
  if (!generation) return false;
  return pokemonId >= generation.minId && pokemonId <= generation.maxId;
}

/**
 * Get all Pokemon IDs in a generation
 */
export function getPokemonIdsInGeneration(gen: number): number[] {
  const generation = getGenerationByNumber(gen);
  if (!generation) return [];
  
  return Array.from(
    { length: generation.maxId - generation.minId + 1 },
    (_, i) => generation.minId + i
  );
}

/**
 * Get generation count
 */
export function getGenerationCount(): number {
  return GENERATIONS.length;
}

/**
 * Get generation for trophy display
 */
export interface GenerationTrophy {
  gen: number;
  name: string;
  message: string;
  isSinnoh: boolean;
}

export function getGenerationTrophy(teamGenerations: number[]): GenerationTrophy | null {
  if (teamGenerations.length === 0) return null;

  // Check if all are same generation
  const uniqueGens = new Set(teamGenerations);
  if (uniqueGens.size !== 1) return null;

  const genNum = teamGenerations[0];
  const gen = getGenerationByNumber(genNum);
  if (!gen) return null;

  const isSinnoh = genNum === 4;

  return {
    gen: genNum,
    name: gen.displayName,
    message: isSinnoh
      ? 'Campeon de Cultura\nHas elegido el camino correcto. Sinnoh aprueba tu equipo.'
      : `Campeon de ${gen.displayName}`,
    isSinnoh,
  };
}

/**
 * Check if team is all from Sinnoh generation
 */
export function isSinnohTeam(teamGenerations: number[]): boolean {
  return teamGenerations.length > 0 && teamGenerations.every(gen => gen === 4);
}

/**
 * Get all generations for a team
 */
export function getTeamGenerations(team: { generation?: number }[]): number[] {
  return team.map(p => p.generation || 1);
}

export default {
  GENERATIONS,
  getGenerationById,
  getGenerationByNumber,
  isInGeneration,
  getPokemonIdsInGeneration,
  getGenerationCount,
  getGenerationTrophy,
  isSinnohTeam,
  getTeamGenerations,
};
