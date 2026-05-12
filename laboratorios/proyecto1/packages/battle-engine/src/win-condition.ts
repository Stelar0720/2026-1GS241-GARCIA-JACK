// Sinnoh Edition - Win Condition Checker
// Determines when a battle is over and who won

import type { BattlePokemon } from '../../shared/src/types.js';

export interface WinConditionResult {
  isOver: boolean;
  winner: string | null;
  loser: string | null;
  condition: WinConditionType;
  message: string;
}

export type WinConditionType = 
  | 'none'
  | 'all_fainted'
  | 'timeout'
  | 'forfeit'
  | 'disconnect';

/**
 * Check if all Pokemon on a team have fainted
 */
export function allTeamFainted(team: BattlePokemon[]): boolean {
  return team.every(pokemon => pokemon.isFainted);
}

/**
 * Check win condition for both players
 */
export function checkWinCondition(
  player1Team: BattlePokemon[],
  player2Team: BattlePokemon[],
  player1Id: string,
  player2Id: string
): WinConditionResult {
  const p1Fainted = allTeamFainted(player1Team);
  const p2Fainted = allTeamFainted(player2Team);

  // Both fainted - shouldn't happen, but draw
  if (p1Fainted && p2Fainted) {
    return {
      isOver: true,
      winner: null,
      loser: null,
      condition: 'all_fainted',
      message: 'The battle ended in a draw!',
    };
  }

  // Player 1 wins
  if (p2Fainted) {
    return {
      isOver: true,
      winner: player1Id,
      loser: player2Id,
      condition: 'all_fainted',
      message: `Victory! All of ${player2Id}'s Pokemon have fainted!`,
    };
  }

  // Player 2 wins
  if (p1Fainted) {
    return {
      isOver: true,
      winner: player2Id,
      loser: player1Id,
      condition: 'all_fainted',
      message: `Defeat! All of ${player1Id}'s Pokemon have fainted!`,
    };
  }

  return {
    isOver: false,
    winner: null,
    loser: null,
    condition: 'none',
    message: '',
  };
}

/**
 * Calculate battle statistics for results screen
 */
export interface BattleStats {
  totalTurns: number;
  player1PokemonUsed: number;
  player2PokemonUsed: number;
  player1PokemonFainted: number;
  player2PokemonFainted: number;
  totalDamageDealt: {
    player1: number;
    player2: number;
  };
}

export function calculateBattleStats(
  player1Team: BattlePokemon[],
  player2Team: BattlePokemon[],
  turnNumber: number
): BattleStats {
  return {
    totalTurns: turnNumber,
    player1PokemonUsed: player1Team.filter(p => p.currentHp < p.maxHp || p.isFainted).length,
    player2PokemonUsed: player2Team.filter(p => p.currentHp < p.maxHp || p.isFainted).length,
    player1PokemonFainted: player1Team.filter(p => p.isFainted).length,
    player2PokemonFainted: player2Team.filter(p => p.isFainted).length,
    totalDamageDealt: {
      player1: 0, // Would need to track this during battle
      player2: 0,
    },
  };
}

/**
 * Check if a player can still battle
 */
export function canStillBattle(team: BattlePokemon[]): boolean {
  return team.some(pokemon => !pokemon.isFainted);
}

/**
 * Get remaining Pokemon count
 */
export function getRemainingPokemon(team: BattlePokemon[]): number {
  return team.filter(pokemon => !pokemon.isFainted).length;
}

/**
 * Generate victory/defeat message
 */
export function generateResultMessage(
  winnerId: string | null,
  winnerName: string,
  loserName: string
): string {
  if (!winnerId) {
    return 'The battle ended in a draw!';
  }

  const verb = winnerName ? 'wins' : 'is victorious';
  return `${winnerName || 'A player'} ${verb}!`;
}

/**
 * Check if battle should end due to timeout (optional rule)
 */
export function checkTimeoutCondition(
  turnNumber: number,
  maxTurns: number = 100
): boolean {
  return turnNumber >= maxTurns;
}

/**
 * Handle timeout result - usually player with more Pokemon wins
 */
export function handleTimeoutWin(
  player1Team: BattlePokemon[],
  player2Team: BattlePokemon[]
): string | null {
  const p1Remaining = getRemainingPokemon(player1Team);
  const p2Remaining = getRemainingPokemon(player2Team);

  if (p1Remaining > p2Remaining) return 'player1';
  if (p2Remaining > p1Remaining) return 'player2';
  
  // If equal, could use HP percentage, but for simplicity, return null (draw)
  return null;
}

export default {
  allTeamFainted,
  checkWinCondition,
  calculateBattleStats,
  canStillBattle,
  getRemainingPokemon,
  generateResultMessage,
  checkTimeoutCondition,
  handleTimeoutWin,
};
