// Sinnoh Edition - Status Effects
// Manages status conditions and their effects

import type { BattlePokemon, StatusEffect, PokemonType } from '../../shared/src/types.js';

export interface StatusEffectResult {
  applied: boolean;
  status: StatusEffect;
  message: string;
  canAct: boolean;
  damage: number;
}

export interface StatusConfig {
  burnDamagePercent: number;
  poisonDamagePercent: number;
  sleepWakeChance: number;
  confusionSelfHitChance: number;
  paralysisSpeedDrop: number;
  freezeThawChance: number;
}

const DEFAULT_STATUS_CONFIG: StatusConfig = {
  burnDamagePercent: 16,      // 1/16 of max HP
  poisonDamagePercent: 8,    // 1/8 of max HP (toxic would be 1/16 * turns)
  sleepWakeChance: 0.33,      // 33% chance to wake each turn
  confusionSelfHitChance: 0.33,
  paralysisSpeedDrop: 0.5,    // Speed reduced by 50%
  freezeThawChance: 0.2,     // 20% chance to thaw
};

/**
 * Check if a status can be applied
 */
export function canApplyStatus(
  currentStatus: StatusEffect,
  newStatus: StatusEffect
): boolean {
  // Can't apply status if already has one
  if (currentStatus !== 'none') return false;
  
  // Can't apply sleep if already has any non-none status
  if (newStatus === 'asleep' && currentStatus !== 'none') return false;
  
  return true;
}

/**
 * Attempt to inflict a status effect based on move type
 */
export function tryInflictStatus(
  moveType: PokemonType,
  target: BattlePokemon
): StatusEffect {
  if (target.status !== 'none') return target.status;
  
  const statusChances: Record<PokemonType, { status: StatusEffect; chance: number }> = {
    fire: { status: 'burned', chance: 0.1 },
    poison: { status: 'poisoned', chance: 0.3 },
    ground: { status: 'poisoned', chance: 0.3 },
    bug: { status: 'poisoned', chance: 0.3 },
    electric: { status: 'paralyzed', chance: 0.1 },
    psychic: { status: 'asleep', chance: 0.1 },
    ice: { status: 'frozen', chance: 0.1 },
    normal: { status: 'none', chance: 0 },
    water: { status: 'none', chance: 0 },
    grass: { status: 'none', chance: 0 },
    fighting: { status: 'none', chance: 0 },
    flying: { status: 'none', chance: 0 },
    rock: { status: 'none', chance: 0 },
    ghost: { status: 'none', chance: 0 },
    dragon: { status: 'none', chance: 0 },
    dark: { status: 'none', chance: 0 },
    steel: { status: 'none', chance: 0 },
    fairy: { status: 'none', chance: 0 },
  };

  const config = statusChances[moveType];
  if (!config || config.chance === 0) return 'none';
  
  if (Math.random() < config.chance) {
    return config.status;
  }
  
  return 'none';
}

/**
 * Process start of turn status effects
 */
export function processStatusStartOfTurn(
  pokemon: BattlePokemon,
  config: Partial<StatusConfig> = {}
): StatusEffectResult {
  const { sleepWakeChance, paralysisSpeedDrop, freezeThawChance } = {
    ...DEFAULT_STATUS_CONFIG,
    ...config,
  };

  switch (pokemon.status) {
    case 'asleep':
      // Check if Pokemon can wake up
      const wokeUp = Math.random() < sleepWakeChance;
      if (wokeUp) {
        return {
          applied: false,
          status: 'none',
          message: `${pokemon.name} woke up!`,
          canAct: true,
          damage: 0,
        };
      }
      return {
        applied: false,
        status: 'asleep',
        message: `${pokemon.name} is fast asleep...`,
        canAct: false,
        damage: 0,
      };

    case 'paralyzed':
      // 25% chance to be fully paralyzed
      const fullyParalyzed = Math.random() < 0.25;
      return {
        applied: false,
        status: 'paralyzed',
        message: fullyParalyzed 
          ? `${pokemon.name} is fully paralyzed!` 
          : `${pokemon.name} is paralyzed and may be unable to attack!`,
        canAct: !fullyParalyzed,
        damage: 0,
      };

    case 'frozen':
      // Check if Pokemon thaws
      const thawed = Math.random() < freezeThawChance;
      if (thawed) {
        return {
          applied: false,
          status: 'none',
          message: `${pokemon.name} thawed out!`,
          canAct: true,
          damage: 0,
        };
      }
      return {
        applied: false,
        status: 'frozen',
        message: `${pokemon.name} is frozen solid!`,
        canAct: false,
        damage: 0,
      };

    case 'confused':
      // 33% chance to hurt self
      const selfHit = Math.random() < config.confusionSelfHitChance || 0.33;
      return {
        applied: false,
        status: 'confused',
        message: `${pokemon.name} is confused!`,
        canAct: !selfHit,
        damage: 0,
      };

    default:
      return {
        applied: false,
        status: pokemon.status,
        message: `${pokemon.name} is ${pokemon.status}!`,
        canAct: true,
        damage: 0,
      };
  }
}

/**
 * Process end of turn status damage (burn/poison)
 */
export function processStatusEndOfTurn(
  pokemon: BattlePokemon,
  config: Partial<StatusConfig> = {}
): StatusEffectResult {
  const { burnDamagePercent, poisonDamagePercent } = {
    ...DEFAULT_STATUS_CONFIG,
    ...config,
  };

  switch (pokemon.status) {
    case 'burned': {
      const damage = Math.floor(pokemon.maxHp / burnDamagePercent);
      return {
        applied: true,
        status: 'burned',
        message: `${pokemon.name} is hurt by its burn!`,
        canAct: true,
        damage,
      };
    }

    case 'poisoned': {
      const damage = Math.floor(pokemon.maxHp / poisonDamagePercent);
      return {
        applied: true,
        status: 'poisoned',
        message: `${pokemon.name} is hurt by poison!`,
        canAct: true,
        damage,
      };
    }

    default:
      return {
        applied: false,
        status: pokemon.status,
        message: '',
        canAct: true,
        damage: 0,
      };
  }
}

/**
 * Get the speed modifier from paralysis
 */
export function getParalysisSpeedModifier(status: StatusEffect): number {
  return status === 'paralyzed' ? 0.5 : 1;
}

/**
 * Get status duration (for sleep)
 */
export function getSleepDuration(): number {
  return Math.floor(Math.random() * 3) + 2; // 2-4 turns
}

/**
 * Check if a status blocks switching
 */
export function blocksSwitching(status: StatusEffect): boolean {
  return status === 'asleep' || status === 'frozen';
}

export default {
  canApplyStatus,
  tryInflictStatus,
  processStatusStartOfTurn,
  processStatusEndOfTurn,
  getParalysisSpeedModifier,
  getSleepDuration,
  blocksSwitching,
};
