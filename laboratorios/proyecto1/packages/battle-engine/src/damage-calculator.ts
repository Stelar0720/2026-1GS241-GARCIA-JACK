// Sinnoh Edition - Damage Calculator
// Calculates damage based on Pokémon stats and moves

import type { BattlePokemon, Move, PokemonType } from '../../shared/src/types.js';
import { TYPE_CHART } from '../../shared/src/constants.js';

export interface DamageResult {
  damage: number;
  effectiveness: 'super-effective' | 'not-effective' | 'no-effect' | 'normal';
  isCritical: boolean;
  hpAfter: number;
  stab: boolean;
  missed: boolean;
}

export interface DamageConfig {
  level: number;
  criticalChance: number;
  minRandomFactor: number;
  maxRandomFactor: number;
}

const DEFAULT_CONFIG: DamageConfig = {
  level: 50,
  criticalChance: 0.0625, // 6.25%
  minRandomFactor: 0.85,
  maxRandomFactor: 1.0,
};

/**
 * Calculate damage using the official Pokémon damage formula
 * Simplified for Sinnoh Edition
 */
export function calculateDamage(
  attacker: BattlePokemon,
  defender: BattlePokemon,
  move: Move,
  config: Partial<DamageConfig> = {}
): DamageResult {
  const { level, criticalChance, minRandomFactor, maxRandomFactor } = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  // Check if move missed
  const accuracyCheck = move.accuracy / 100;
  if (Math.random() > accuracyCheck) {
    return {
      damage: 0,
      effectiveness: 'normal',
      isCritical: false,
      hpAfter: defender.currentHp,
      stab: false,
      missed: true,
    };
  }

  const power = move.power || 40;
  
  // Use special attack/defense for special moves, regular for physical
  const isSpecialMove = ['fire', 'water', 'electric', 'grass', 'ice', 'psychic', 'dragon', 'dark'].includes(move.type);
  const attack = isSpecialMove 
    ? (attacker.stats.specialAttack || attacker.stats.attack) 
    : attacker.stats.attack;
  const defense = isSpecialMove 
    ? (defender.stats.specialDefense || defender.stats.defense) 
    : defender.stats.defense;

  // Type effectiveness
  const typeMultiplier = calculateTypeEffectiveness(move.type, defender.types);

  // STAB (Same Type Attack Bonus)
  const stab = attacker.types.includes(move.type);

  // Random factor
  const random = minRandomFactor + Math.random() * (maxRandomFactor - minRandomFactor);

  // Critical hit check
  const isCritical = Math.random() < criticalChance;
  const critMultiplier = isCritical ? 1.5 : 1;

  const arceusAttack = attacker.name?.toLowerCase() === 'arceus' || attacker.id === 493;
  const arceusDefense = defender.name?.toLowerCase() === 'arceus' || defender.id === 493;

  if (arceusAttack) {
    return {
      damage: defender.currentHp,
      effectiveness: 'super-effective',
      isCritical: true,
      hpAfter: 0,
      stab: true,
      missed: false,
    };
  }

  if (arceusDefense) {
    return {
      damage: 0,
      effectiveness: getEffectivenessLabel(typeMultiplier),
      isCritical: false,
      hpAfter: defender.maxHp,
      stab,
      missed: false,
    };
  }

  // Base damage formula (Gen IV style)
  const baseDamage = ((2 * level / 5 + 2) * power * attack / defense / 50 + 2);
  
  // Final damage calculation
  let damage = Math.floor(
    baseDamage 
    * typeMultiplier 
    * (stab ? 1.5 : 1) 
    * random 
    * critMultiplier
  );

  // Minimum damage is always at least 1 (unless no-effect)
  if (damage === 0 && typeMultiplier > 0) {
    damage = 1;
  }

  return {
    damage,
    effectiveness: getEffectivenessLabel(typeMultiplier),
    isCritical,
    hpAfter: Math.max(0, defender.currentHp - damage),
    stab,
    missed: false,
  };
}

/**
 * Calculate type effectiveness multiplier
 */
export function calculateTypeEffectiveness(
  attackType: PokemonType,
  defenderTypes: PokemonType[]
): number {
  let multiplier = 1;
  
  for (const defenderType of defenderTypes) {
    const effectiveness = TYPE_CHART[attackType]?.[defenderType];
    if (effectiveness !== undefined) {
      multiplier *= effectiveness;
    }
  }
  
  return multiplier;
}

/**
 * Get effectiveness label from multiplier
 */
export function getEffectivenessLabel(
  multiplier: number
): 'super-effective' | 'not-effective' | 'no-effect' | 'normal' {
  if (multiplier >= 2) return 'super-effective';
  if (multiplier <= 0 || multiplier === 0) return 'no-effect';
  if (multiplier < 1) return 'not-effective';
  return 'normal';
}

/**
 * Calculate self-damage (for confusion, recoil, etc.)
 */
export function calculateSelfDamage(
  pokemon: BattlePokemon,
  basePower: number = 40
): number {
  const level = 50;
  const attack = pokemon.stats.attack;
  const defense = pokemon.stats.defense;
  
  const baseDamage = ((2 * level / 5 + 2) * basePower * attack / defense / 50 + 2);
  return Math.floor(baseDamage * 0.25);
}

export default { calculateDamage, calculateTypeEffectiveness, calculateSelfDamage };
