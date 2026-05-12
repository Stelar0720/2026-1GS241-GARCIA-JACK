// Sinnoh Edition - Switch Rules
// Manages Pokemon switching rules and restrictions

import type { BattlePokemon } from '../../shared/src/types.js';

export interface SwitchResult {
  success: boolean;
  message: string;
  previousPokemon: BattlePokemon | null;
  newPokemon: BattlePokemon | null;
}

export interface SwitchConfig {
  allowsSwitch: boolean;
  consumesTurn: boolean;
  cannotSwitchWhileTrapped: boolean;
}

/**
 * Check if a Pokemon can be switched to
 */
export function canSwitchTo(
  pokemon: BattlePokemon,
  isTrapped: boolean = false,
  config: Partial<SwitchConfig> = {}
): SwitchResult {
  const { cannotSwitchWhileTrapped = true } = config;

  // Cannot switch to fainted Pokemon
  if (pokemon.isFainted) {
    return {
      success: false,
      message: `Cannot switch to ${pokemon.name} - it has fainted!`,
      previousPokemon: null,
      newPokemon: null,
    };
  }

  // Cannot switch to active Pokemon
  if (pokemon.isActive) {
    return {
      success: false,
      message: `${pokemon.name} is already active!`,
      previousPokemon: null,
      newPokemon: null,
    };
  }

  // Check trap status
  if (isTrapped && cannotSwitchWhileTrapped) {
    return {
      success: false,
      message: `Cannot switch! ${pokemon.name} is trapped!`,
      previousPokemon: null,
      newPokemon: null,
    };
  }

  return {
    success: true,
    message: `Ready to switch to ${pokemon.name}!`,
    previousPokemon: null,
    newPokemon: pokemon,
  };
}

/**
 * Perform a switch action
 */
export function performSwitch(
  team: BattlePokemon[],
  currentIndex: number,
  targetIndex: number
): SwitchResult {
  const currentPokemon = team[currentIndex];
  const targetPokemon = team[targetIndex];

  // Validate target
  const switchCheck = canSwitchTo(targetPokemon);
  if (!switchCheck.success) {
    return switchCheck;
  }

  // Perform switch
  currentPokemon.isActive = false;
  currentPokemon.status = 'none'; // Clear status on switch
  targetPokemon.isActive = true;

  return {
    success: true,
    message: `Go! ${targetPokemon.name}!`,
    previousPokemon: currentPokemon,
    newPokemon: targetPokemon,
  };
}

/**
 * Check if all Pokemon are fainted (battle over condition)
 */
export function allPokemonFainted(team: BattlePokemon[]): boolean {
  return team.every(pokemon => pokemon.isFainted);
}

/**
 * Get available Pokemon for switching
 */
export function getAvailablePokemon(team: BattlePokemon[]): BattlePokemon[] {
  return team.filter(pokemon => !pokemon.isFainted && !pokemon.isActive);
}

/**
 * Check if player has any Pokemon left to fight
 */
export function hasPokemonLeft(team: BattlePokemon[]): boolean {
  return team.some(pokemon => !pokemon.isFainted);
}

/**
 * Get the active Pokemon from a team
 */
export function getActivePokemon(team: BattlePokemon[]): BattlePokemon | null {
  return team.find(pokemon => pokemon.isActive && !pokemon.isFainted) || null;
}

/**
 * Auto-select next available Pokemon
 */
export function autoSelectNextPokemon(team: BattlePokemon[]): BattlePokemon | null {
  const available = getAvailablePokemon(team);
  return available.length > 0 ? available[0] : null;
}

/**
 * Calculate remaining Pokemon count
 */
export function getRemainingCount(team: BattlePokemon[]): number {
  return team.filter(pokemon => !pokemon.isFainted).length;
}

/**
 * Check if forced to switch (no active Pokemon)
 */
export function isForcedToSwitch(team: BattlePokemon[]): boolean {
  const active = getActivePokemon(team);
  return active === null;
}

export default {
  canSwitchTo,
  performSwitch,
  allPokemonFainted,
  getAvailablePokemon,
  hasPokemonLeft,
  getActivePokemon,
  autoSelectNextPokemon,
  getRemainingCount,
  isForcedToSwitch,
};
