// Sinnoh Edition - Turn Manager
// Manages turn order and turn-based actions

import type { BattlePokemon, BattleLogEntry } from '../../shared/src/types.js';

export interface TurnOrder {
  playerId: string;
  speed: number;
  priority: number;
}

export interface TurnResult {
  turnNumber: number;
  firstPlayerId: string;
  actions: BattleLogEntry[];
  turnEnded: boolean;
}

/**
 * Determines turn order based on speed and priority
 */
export function determineTurnOrder(
  player1Active: BattlePokemon | null,
  player2Active: BattlePokemon | null,
  player1Id: string,
  player2Id: string
): TurnOrder[] {
  const orders: TurnOrder[] = [];

  if (player1Active) {
    orders.push({
      playerId: player1Id,
      speed: player1Active.stats.speed || 100,
      priority: 0, // Could be modified by priority moves
    });
  }

  if (player2Active) {
    orders.push({
      playerId: player2Id,
      speed: player2Active.stats.speed || 100,
      priority: 0,
    });
  }

  // Sort by priority first, then by speed (higher speed goes first)
  return orders.sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    return b.speed - a.speed;
  });
}

/**
 * Creates a new turn log entry
 */
export function createTurnLogEntry(
  turn: number,
  actorId: string,
  action: 'attack' | 'switch' | 'run',
  sourcePokemon: number,
  targetPokemon: number,
  logMessage: string,
  moveUsed?: any,
  damageDealt?: number,
  statusApplied?: string,
  effectiveness?: 'super-effective' | 'not-effective' | 'no-effect' | 'normal'
): BattleLogEntry {
  return {
    turn,
    actorId,
    action,
    sourcePokemon,
    targetPokemon,
    moveUsed,
    damageDealt,
    statusApplied: statusApplied as any,
    effectiveness,
    logMessage,
    timestamp: Date.now(),
  };
}

export class TurnManager {
  private currentTurn: number = 0;
  private currentActorIndex: number = 0;
  private turnOrder: TurnOrder[] = [];

  reset() {
    this.currentTurn = 0;
    this.currentActorIndex = 0;
    this.turnOrder = [];
  }

  setTurnOrder(order: TurnOrder[]) {
    this.turnOrder = order;
  }

  startNewTurn() {
    this.currentTurn++;
    this.currentActorIndex = 0;
  }

  getCurrentTurn(): number {
    return this.currentTurn;
  }

  getNextActor(): TurnOrder | null {
    if (this.currentActorIndex >= this.turnOrder.length) {
      return null;
    }
    return this.turnOrder[this.currentActorIndex++];
  }

  hasMoreActors(): boolean {
    return this.currentActorIndex < this.turnOrder.length;
  }

  skipCurrentActor() {
    this.currentActorIndex++;
  }
}

export default new TurnManager();
