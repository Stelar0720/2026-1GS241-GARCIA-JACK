// Sinnoh Edition - Battle Service
// Handles battle state management and turn processing

import type { BattlePokemon, Move, BattleLogEntry, StatusEffect } from '../../../../packages/shared/src/types.js';
import { BattleEngine } from '../../../../packages/battle-engine/src/battle-engine.js';

export interface BattleState {
  roomId: string;
  player1Id: string;
  player2Id: string;
  player1Team: BattlePokemon[];
  player2Team: BattlePokemon[];
  currentTurn: string | null;
  turnNumber: number;
  isOver: boolean;
  winner: string | null;
  logs: BattleLogEntry[];
  godMode: boolean;
}

export interface BattleAction {
  type: 'attack' | 'switch' | 'surrender';
  playerId: string;
  moveIndex?: number;
  pokemonIndex?: number;
}

export interface BattleResult {
  success: boolean;
  logs: BattleLogEntry[];
  isOver: boolean;
  winner: string | null;
  message: string;
}

export interface BattleServiceConfig {
  godModeEnabled: boolean;
  maxTurns: number;
}

// In-memory battle state storage
const activeBattles = new Map<string, BattleState>();
const battleEngines = new Map<string, BattleEngine>();

export const battleServiceConfig: BattleServiceConfig = {
  godModeEnabled: false,
  maxTurns: 100,
};

/**
 * Start a new battle
 */
export function startBattle(
  roomId: string,
  player1Id: string,
  player1Team: BattlePokemon[],
  player2Id: string,
  player2Team: BattlePokemon[]
): BattleState {
  // Initialize teams
  const p1Team = player1Team.map((p, i) => ({
    ...p,
    isActive: i === 0,
    isFainted: false,
    currentHp: p.stats.hp,
    maxHp: p.stats.hp,
    status: 'none' as StatusEffect,
  }));

  const p2Team = player2Team.map((p, i) => ({
    ...p,
    isActive: i === 0,
    isFainted: false,
    currentHp: p.stats.hp,
    maxHp: p.stats.hp,
    status: 'none' as StatusEffect,
  }));

  const battleState: BattleState = {
    roomId,
    player1Id,
    player2Id,
    player1Team: p1Team,
    player2Team: p2Team,
    currentTurn: null,
    turnNumber: 0,
    isOver: false,
    winner: null,
    logs: [],
    godMode: battleServiceConfig.godModeEnabled,
  };

  // Create battle engine
  const engine = new BattleEngine(p1Team, p2Team, battleServiceConfig.godModeEnabled);
  battleEngines.set(roomId, engine);

  // Determine first turn
  battleState.currentTurn = engine.determineFirstTurn(player1Id, player2Id);
  battleState.turnNumber = 1;

  activeBattles.set(roomId, battleState);

  return battleState;
}

/**
 * Get battle state
 */
export function getBattleState(roomId: string): BattleState | null {
  return activeBattles.get(roomId) || null;
}

/**
 * Execute a battle action
 */
export function executeAction(action: BattleAction): BattleResult {
  const battle = Array.from(activeBattles.values()).find(
    b => b.player1Id === action.playerId || b.player2Id === action.playerId
  );

  if (!battle) {
    return {
      success: false,
      logs: [],
      isOver: false,
      winner: null,
      message: 'Battle not found',
    };
  }

  const engine = battleEngines.get(battle.roomId);

  if (!engine) {
    return {
      success: false,
      logs: [],
      isOver: false,
      winner: null,
      message: 'Battle engine not found',
    };
  }

  switch (action.type) {
    case 'attack':
      if (action.moveIndex === undefined) {
        return { success: false, logs: [], isOver: false, winner: null, message: 'Move index required' };
      }
      const opponentId = battle.player1Id === action.playerId ? battle.player2Id : battle.player1Id;
      
      const result = engine.executeAttack(action.playerId, opponentId, action.moveIndex);
      
      if (result.success) {
        // Apply end of turn effects
        engine.applyEndOfTurnEffects(action.playerId);
        engine.applyEndOfTurnEffects(opponentId);
      }

      return {
        success: result.success,
        logs: result.logs,
        isOver: engine.isOver(),
        winner: engine.getWinner(),
        message: result.message,
      };

    case 'switch':
      if (action.pokemonIndex === undefined) {
        return { success: false, logs: [], isOver: false, winner: null, message: 'Pokemon index required' };
      }
      const switchResult = engine.executeSwitch(action.playerId, action.pokemonIndex);
      
      return {
        success: switchResult.success,
        logs: switchResult.logs,
        isOver: engine.isOver(),
        winner: engine.getWinner(),
        message: switchResult.message,
      };

    case 'surrender':
      const surrenderResult = handleSurrender(action.playerId);
      return surrenderResult;

    default:
      return { success: false, logs: [], isOver: false, winner: null, message: 'Unknown action type' };
  }
}

/**
 * Handle surrender
 */
function handleSurrender(playerId: string): BattleResult {
  const battle = Array.from(activeBattles.values()).find(
    b => b.player1Id === playerId || b.player2Id === playerId
  );

  if (!battle) {
    return { success: false, logs: [], isOver: false, winner: null, message: 'Battle not found' };
  }

  const winner = battle.player1Id === playerId ? battle.player2Id : battle.player1Id;
  battle.isOver = true;
  battle.winner = winner;

  const log: BattleLogEntry = {
    turn: battle.turnNumber,
    actorId: playerId,
    action: 'run',
    sourcePokemon: 0,
    targetPokemon: 0,
    logMessage: `${playerId} surrendered!`,
    timestamp: Date.now(),
  };
  battle.logs.push(log);

  return {
    success: true,
    logs: [log],
    isOver: true,
    winner,
    message: `${playerId} surrendered! ${winner} wins!`,
  };
}

/**
 * Get active Pokemon for a player
 */
export function getActivePokemon(roomId: string, playerId: string): BattlePokemon | null {
  const battle = activeBattles.get(roomId);
  if (!battle) return null;

  if (battle.player1Id === playerId) {
    return battle.player1Team.find(p => p.isActive) || null;
  }
  return battle.player2Team.find(p => p.isActive) || null;
}

/**
 * Check if it's a player's turn
 */
export function isPlayerTurn(roomId: string, playerId: string): boolean {
  const battle = activeBattles.get(roomId);
  if (!battle || battle.isOver) return false;
  return battle.currentTurn === playerId;
}

/**
 * End current turn and switch to next player
 */
export function endTurn(roomId: string): string | null {
  const battle = activeBattles.get(roomId);
  if (!battle) return null;

  const nextPlayer = battle.currentTurn === battle.player1Id 
    ? battle.player2Id 
    : battle.player1Id;

  battle.currentTurn = nextPlayer;
  battle.turnNumber++;

  return nextPlayer;
}

/**
 * End battle and cleanup
 */
export function endBattle(roomId: string): BattleState | null {
  const battle = activeBattles.get(roomId);
  if (!battle) return null;

  battle.isOver = true;
  activeBattles.delete(roomId);
  battleEngines.delete(roomId);

  return battle;
}

/**
 * Check for timeout
 */
export function checkTimeout(roomId: string): boolean {
  const battle = activeBattles.get(roomId);
  if (!battle) return false;
  return battle.turnNumber >= battleServiceConfig.maxTurns;
}

export default {
  startBattle,
  getBattleState,
  executeAction,
  getActivePokemon,
  isPlayerTurn,
  endTurn,
  endBattle,
  checkTimeout,
  config: battleServiceConfig,
};
