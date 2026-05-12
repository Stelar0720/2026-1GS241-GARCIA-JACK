// Sinnoh Edition - Random Move Selector
// Selects random moves for Pokemon when needed

import type { Move, BattlePokemon } from '../../shared/src/types.js';

export interface MoveSelectionConfig {
  maxMoves: number;
  preferHigherPower: boolean;
  minPowerThreshold: number;
  includeStatusMoves: boolean;
}

const DEFAULT_MOVE_CONFIG: MoveSelectionConfig = {
  maxMoves: 4,
  preferHigherPower: false,
  minPowerThreshold: 0,
  includeStatusMoves: true,
};

/**
 * Filter moves that can be used in battle
 */
export function filterUsableMoves(
  moves: Move[],
  config: Partial<MoveSelectionConfig> = {}
): Move[] {
  const { minPowerThreshold, includeStatusMoves } = {
    ...DEFAULT_MOVE_CONFIG,
    ...config,
  };

  return moves.filter(move => {
    // Must have PP
    if (move.pp <= 0) return false;
    
    // Check power threshold
    if (!includeStatusMoves && move.power < minPowerThreshold) {
      return false;
    }
    
    return true;
  });
}

/**
 * Select random moves from a pool
 */
export function selectRandomMoves(
  availableMoves: Move[],
  count: number = 4,
  config: Partial<MoveSelectionConfig> = {}
): Move[] {
  const { maxMoves, preferHigherPower } = {
    ...DEFAULT_MOVE_CONFIG,
    ...config,
  };

  const usableMoves = filterUsableMoves(availableMoves, config);
  
  if (usableMoves.length === 0) {
    return [];
  }

  // If we have fewer moves than requested, return all
  const actualCount = Math.min(count, maxMoves, usableMoves.length);

  if (preferHigherPower) {
    // Sort by power (descending) and take top moves
    const sorted = [...usableMoves].sort((a, b) => (b.power || 0) - (a.power || 0));
    return sorted.slice(0, actualCount);
  }

  // Fisher-Yates shuffle and take first N
  const shuffled = shuffleMoves([...usableMoves]);
  return shuffled.slice(0, actualCount);
}

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleMoves<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Select moves with type variety
 */
export function selectMovesWithVariety(
  availableMoves: Move[],
  count: number = 4,
  pokemonTypes: string[]
): Move[] {
  const usableMoves = filterUsableMoves(availableMoves);
  const selected: Move[] = [];
  const usedTypes = new Set<string>();

  // Prioritize moves that are STAB (same type)
  const stabMoves = usableMoves.filter(move => 
    pokemonTypes.includes(move.type)
  );
  
  // Add STAB moves first
  const shuffledStab = shuffleMoves(stabMoves);
  for (const move of shuffledStab) {
    if (selected.length >= count) break;
    selected.push(move);
    usedTypes.add(move.type);
  }

  // Fill remaining slots with non-duplicate type moves
  if (selected.length < count) {
    const nonStabMoves = usableMoves.filter(move => 
      !usedTypes.has(move.type)
    );
    const shuffledNonStab = shuffleMoves(nonStabMoves);
    
    for (const move of shuffledNonStab) {
      if (selected.length >= count) break;
      selected.push(move);
      usedTypes.add(move.type);
    }
  }

  return selected;
}

/**
 * Get a default move set for when no moves are available
 */
export function getDefaultMoves(): Move[] {
  return [
    {
      id: 1,
      name: 'Tackle',
      type: 'normal',
      power: 40,
      accuracy: 100,
      pp: 35,
      maxPp: 35,
    },
    {
      id: 2,
      name: 'Growl',
      type: 'normal',
      power: 0,
      accuracy: 100,
      pp: 40,
      maxPp: 40,
    },
    {
      id: 3,
      name: 'Tail Whip',
      type: 'normal',
      power: 0,
      accuracy: 100,
      pp: 30,
      maxPp: 30,
    },
    {
      id: 33,
      name: 'Bind',
      type: 'normal',
      power: 15,
      accuracy: 85,
      pp: 20,
      maxPp: 20,
    },
  ];
}

/**
 * Assign random moves to a Pokemon based on available moves from API
 */
export function assignRandomMoves(
  pokemon: BattlePokemon,
  movesFromApi: any[]
): BattlePokemon {
  const randomMoves = selectRandomMoves(movesFromApi, 4);
  
  return {
    ...pokemon,
    moves: randomMoves,
  };
}

export default {
  filterUsableMoves,
  selectRandomMoves,
  selectMovesWithVariety,
  getDefaultMoves,
  assignRandomMoves,
};
