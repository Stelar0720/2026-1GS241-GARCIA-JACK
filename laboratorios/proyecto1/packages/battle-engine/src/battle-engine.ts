// Sinnoh Edition - Battle Engine Package
// Core battle mechanics for Pokémon combat

import type { BattlePokemon, Move, StatusEffect, BattleLogEntry, PokemonType } from '../../shared/src/types.js';
import { GAME_CONFIG } from '../../shared/src/types.js';
import { TYPE_CHART } from '../../shared/src/constants.js';

export interface BattleState {
  player1Team: BattlePokemon[];
  player2Team: BattlePokemon[];
  currentTurnPlayerId: string | null;
  turnNumber: number;
  isOver: boolean;
  winner: string | null;
  logs: BattleLogEntry[];
}

export interface TurnResult {
  success: boolean;
  logs: BattleLogEntry[];
  message: string;
  targetFainted?: boolean;
  attackerFainted?: boolean;
}

export interface DamageResult {
  damage: number;
  effectiveness: 'super-effective' | 'not-effective' | 'no-effect' | 'normal';
  isCritical: boolean;
  hpAfter: number;
}

export class BattleEngine {
  private state: BattleState;
  private godMode: boolean;

  constructor(player1Team: BattlePokemon[], player2Team: BattlePokemon[], godMode: boolean = GAME_CONFIG.TESTING_GOD_MODE) {
    this.state = {
      player1Team: player1Team.map(p => ({ ...p, isActive: false, isFainted: false })),
      player2Team: player2Team.map(p => ({ ...p, isActive: false, isFainted: false })),
      currentTurnPlayerId: null,
      turnNumber: 0,
      isOver: false,
      winner: null,
      logs: [],
    };
    this.godMode = godMode;

    // Set first active pokemon for each team
    if (player1Team.length > 0) this.state.player1Team[0].isActive = true;
    if (player2Team.length > 0) this.state.player2Team[0].isActive = true;
  }

  determineFirstTurn(player1Id: string, player2Id: string): string {
    // Simple speed check - or coin flip result passed in
    const p1Active = this.state.player1Team.find(p => p.isActive && !p.isFainted);
    const p2Active = this.state.player2Team.find(p => p.isActive && !p.isFainted);

    if (!p1Active || !p2Active) return player1Id;
    return p1Active.stats.speed >= p2Active.stats.speed ? player1Id : player2Id;
  }

  executeAttack(attackerId: string, targetId: string, moveIndex: number): TurnResult {
    if (this.state.isOver) {
      return { success: false, logs: [], message: 'Battle is over' };
    }

    const logs: BattleLogEntry[] = [];
    const isPlayer1 = this.getPlayerTeam(attackerId) === this.state.player1Team;
    const attackerTeam = isPlayer1 ? this.state.player1Team : this.state.player2Team;
    const defenderTeam = isPlayer1 ? this.state.player2Team : this.state.player1Team;

    const attacker = attackerTeam.find(p => p.isActive && !p.isFainted);
    const defender = defenderTeam.find(p => p.isActive && !p.isFainted);

    if (!attacker || !defender) {
      return { success: false, logs, message: 'No active pokemon found' };
    }

    if (attacker.status === 'asleep') {
      const wakeUp = Math.random() < 0.33;
      if (!wakeUp) {
        logs.push({
          turn: this.state.turnNumber,
          actorId: attackerId,
          action: 'attack',
          sourcePokemon: attacker.id,
          targetPokemon: defender.id,
          logMessage: `${attacker.name} is asleep and can't move!`,
          timestamp: Date.now(),
        });
        return { success: true, logs, message: 'Pokemon is asleep' };
      }
      attacker.status = 'none';
    }

    if (attacker.status === 'confused') {
      const selfHit = Math.random() < 0.33;
      if (selfHit) {
        const damage = this.calculateSelfDamage(attacker);
        attacker.currentHp -= damage;
        attacker.isFainted = attacker.currentHp <= 0;
        logs.push({
          turn: this.state.turnNumber,
          actorId: attackerId,
          action: 'attack',
sourcePokemon: attacker.id,
          targetPokemon: attacker.id,
          damageDealt: damage,
          logMessage: `${attacker.name} hurt itself in confusion!`,
          timestamp: Date.now(),
        });
        return { success: true, logs, message: 'Hurt itself in confusion', targetFainted: attacker.isFainted };
      }
    }

    if (attacker.status === 'paralyzed') {
      if (Math.random() < 0.25) {
        logs.push({
          turn: this.state.turnNumber,
          actorId: attackerId,
          action: 'attack',
          sourcePokemon: attacker.id,
          targetPokemon: defender.id,
          logMessage: `${attacker.name} is fully paralyzed and can't move!`,
          timestamp: Date.now(),
        });
        return { success: true, logs, message: 'Paralyzed, cannot attack' };
      }
    }

    if (moveIndex < 0 || moveIndex >= attacker.moves.length) {
      return { success: false, logs, message: 'Invalid move' };
    }

    const move = attacker.moves[moveIndex];
    if (!move || move.pp <= 0) {
      return { success: false, logs, message: 'No PP left for this move' };
    }

    move.pp--;
    const damageResult = this.calculateDamage(attacker, defender, move);
    defender.currentHp = Math.max(0, damageResult.hpAfter);

    const effectiveness = this.getEffectivenessMessage(move.type, defender.types[0]);
    defender.status = this.checkStatusInfliction(move.type, defender.status);

    logs.push({
      turn: this.state.turnNumber,
      actorId: attackerId,
      action: 'attack',
      sourcePokemon: attacker.id,
      targetPokemon: defender.id,
      moveUsed: move,
      damageDealt: damageResult.damage,
      effectiveness: effectiveness === 'normal' ? undefined : effectiveness,
      logMessage: `${attacker.name} used ${move.name}! ${damageResult.damage} damage dealt.`,
      timestamp: Date.now(),
    });

    const targetFainted = defender.currentHp <= 0;
    if (targetFainted) {
      defender.isFainted = true;
      defender.status = 'none';
      logs.push({
        turn: this.state.turnNumber,
        actorId: targetId,
        action: 'attack',
        sourcePokemon: defender.id,
        targetPokemon: defender.id,
        logMessage: `${defender.name} fainted!`,
        timestamp: Date.now(),
      });
    }

    // Check win condition
    this.checkWinCondition(attackerId);

    return {
      success: true,
      logs,
      message: `Used ${move.name}!`,
      targetFainted,
    };
  }

  executeSwitch(playerId: string, pokemonIndex: number): TurnResult {
    if (this.state.isOver) {
      return { success: false, logs: [], message: 'Battle is over' };
    }

    const logs: BattleLogEntry[] = [];
    const isPlayer1 = this.getPlayerTeam(playerId) === this.state.player1Team;
    const team = isPlayer1 ? this.state.player1Team : this.state.player2Team;

    if (pokemonIndex < 0 || pokemonIndex >= team.length) {
      return { success: false, logs, message: 'Invalid pokemon index' };
    }

    const newPokemon = team[pokemonIndex];
    if (newPokemon.isFainted) {
      return { success: false, logs, message: 'Cannot switch to fainted pokemon' };
    }

    const currentActive = team.find(p => p.isActive);
    if (currentActive) {
      currentActive.isActive = false;
    }

    newPokemon.isActive = true;
    newPokemon.status = 'none'; // Clear status on switch

    logs.push({
      turn: this.state.turnNumber,
      actorId: playerId,
      action: 'switch',
      sourcePokemon: currentActive?.id || 0,
      targetPokemon: newPokemon.id,
      logMessage: `Go! ${newPokemon.name}!`,
      timestamp: Date.now(),
    });

    return { success: true, logs, message: `Switched to ${newPokemon.name}` };
  }

  private calculateDamage(attacker: BattlePokemon, defender: BattlePokemon, move: Move): DamageResult {
    // God Mode check
    if (this.godMode && attacker.name === 'Arceus') {
      return {
        damage: defender.currentHp,
        effectiveness: 'super-effective',
        isCritical: true,
        hpAfter: 0,
      };
    }

    const level = 50; // Base level
    const power = move.power || 40;
    const attack = attacker.stats.attack;
    const defense = defender.stats.defense;

    // Type effectiveness
    const typeMultiplier = TYPE_CHART[move.type]?.[defender.types[0]] ?? 1;
    
    // STAB (Same Type Attack Bonus)
    const stab = attacker.types.includes(move.type) ? 1.5 : 1;
    
    // Random factor (85-100%)
    const random = 0.85 + Math.random() * 0.15;
    
    // Critical hit (6.25% chance)
    const isCritical = Math.random() < 0.0625;
    const critMultiplier = isCritical ? 1.5 : 1;

    // Damage formula (simplified Gen IV style)
    const baseDamage = ((2 * level / 5 + 2) * power * attack / defense / 50 + 2);
    const damage = Math.floor(baseDamage * typeMultiplier * stab * random * critMultiplier);

    return {
      damage,
      effectiveness: this.getEffectiveness(move.type, defender.types[0]),
      isCritical,
      hpAfter: defender.currentHp - damage,
    };
  }

  private calculateSelfDamage(attacker: BattlePokemon): number {
    const level = 50;
    const power = 40;
    const attack = attacker.stats.attack;
    const defense = attacker.stats.defense;
    
    const baseDamage = ((2 * level / 5 + 2) * power * attack / defense / 50 + 2);
    return Math.floor(baseDamage * 0.25 * 0.85);
  }

  private getEffectiveness(attackType: PokemonType, defenseType: PokemonType): 'super-effective' | 'not-effective' | 'no-effect' | 'normal' {
    const multiplier = TYPE_CHART[attackType]?.[defenseType] ?? 1;
    if (multiplier >= 2) return 'super-effective';
    if (multiplier <= 0) return 'no-effect';
    if (multiplier < 1) return 'not-effective';
    return 'normal';
  }

  private getEffectivenessMessage(attackType: PokemonType, defenseType: PokemonType): 'super-effective' | 'not-effective' | 'no-effect' | 'normal' {
    return this.getEffectiveness(attackType, defenseType);
  }

  private checkStatusInfliction(moveType: PokemonType, currentStatus: StatusEffect): StatusEffect {
    if (currentStatus !== 'none') return currentStatus;

    const statusChances: Record<PokemonType, number> = {
      fire: 0.1,    // Burn 10%
      poison: 0.3,   // Poison 30%
      ice: 0.1,     // Freeze 10%
      electric: 0.1, // Paralysis 10%
      psychic: 0.1,  // Sleep 10%
      bug: 0.3,     // Poison 30%
      ground: 0.3,  // Poison 30%
      normal: 0,    
      water: 0,    
      grass: 0,    
      fighting: 0, 
      flying: 0,   
      rock: 0,     
      ghost: 0,    
      dragon: 0,   
      dark: 0,     
      steel: 0,    
      fairy: 0,    
    };

    if (Math.random() < (statusChances[moveType] || 0)) {
      if (moveType === 'fire') return 'burned';
      if (moveType === 'poison' || moveType === 'ground' || moveType === 'bug') return 'poisoned';
      if (moveType === 'ice') return 'frozen';
      if (moveType === 'electric') return 'paralyzed';
      if (moveType === 'psychic') return 'asleep';
    }

    return currentStatus;
  }

  applyEndOfTurnEffects(playerId: string): TurnResult[] {
    const results: TurnResult[] = [];
    const isPlayer1 = this.getPlayerTeam(playerId) === this.state.player1Team;
    const team = isPlayer1 ? this.state.player1Team : this.state.player2Team;

    for (const pokemon of team) {
      if (pokemon.isFainted) continue;

      // Status damage
      if (pokemon.status === 'burned' || pokemon.status === 'poisoned') {
        const damage = Math.floor(pokemon.maxHp / 16);
        pokemon.currentHp = Math.max(0, pokemon.currentHp - damage);
        
        results.push({
          success: true,
          logs: [{
            turn: this.state.turnNumber,
            actorId: playerId,
            action: 'attack',
            sourcePokemon: pokemon.id,
            targetPokemon: pokemon.id,
            damageDealt: damage,
            logMessage: `${pokemon.name} is hurt by ${pokemon.status}!`,
            timestamp: Date.now(),
          }],
          message: 'Status damage applied',
          targetFainted: pokemon.currentHp <= 0,
        });

        if (pokemon.currentHp <= 0) {
          pokemon.isFainted = true;
          pokemon.status = 'none';
        }
      }
    }

    return results;
  }

  private checkWinCondition(lastAttackerId: string): void {
    const p1AllFainted = this.state.player1Team.every(p => p.isFainted);
    const p2AllFainted = this.state.player2Team.every(p => p.isFainted);

    if (p1AllFainted || p2AllFainted) {
      this.state.isOver = true;
      this.state.winner = p1AllFainted ? 'player2' : 'player1';
    }
  }

  getActivePokemon(playerId: string): BattlePokemon | null {
    const team = this.getPlayerTeam(playerId);
    return team.find(p => p.isActive && !p.isFainted) || null;
  }

  private getPlayerTeam(playerId: string): BattlePokemon[] {
    return this.state.player1Team[0]?.id ? this.state.player1Team : this.state.player2Team;
  }

  getState(): Readonly<BattleState> {
    return { ...this.state };
  }

  isOver(): boolean {
    return this.state.isOver;
  }

  getWinner(): string | null {
    return this.state.winner;
  }
}

// Random move selector for team fills
export function selectRandomMoves(moves: Move[], count: number = 4): Move[] {
  const available = moves.filter(m => m.pp > 0);
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// Random team generator
export function selectRandomTeam(pool: CachePokemon[], count: number, bannedIds: string[]): CachePokemon[] {
  const available = pool.filter(p => !bannedIds.includes(p.id.toString()));
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

import type { CachePokemon } from '../../shared/src/types.js';
