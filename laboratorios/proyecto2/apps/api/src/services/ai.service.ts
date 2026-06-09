/*  Funciones principales:

  - aStarSearch(...): implementación principal de A*.
  - estimateHeuristicCost(...): calcula h(n).
  - moveCost(...): calcula g(n).
  - evaluateBoard(...): heurística de evaluación del tablero.
  - calculateBestMove(...): función que usa el juego para pedir el movimiento de la IA; internamente llama a aStarSearch(...).

  Dónde se llama:

  apps/api/src/index.ts:327 */

import type { Board, Player, Move, AIConfig, Difficulty, CheckersVariant } from '@checkers/shared';
import {
  getLegalMoves,
  applyMove,
  getOpponent,
  getJumpMoves,
  checkGameOver
} from './game.service';

// Configuraciones de IA por dificultad. La IA usa A*; useAlphaBeta queda en false
// por compatibilidad con el tipo compartido existente.
export const AI_CONFIGS: Record<Difficulty, AIConfig> = {
  easy: {
    difficulty: 'easy',
    maxDepth: 2,
    useAlphaBeta: false,
    weights: {
      pieceValue: 10,
      kingValue: 15,
      centerControl: 3,
      advancementBonus: 2,
      jumpOpportunity: 10
    }
  },
  medium: {
    difficulty: 'medium',
    maxDepth: 4,
    useAlphaBeta: false,
    weights: {
      pieceValue: 10,
      kingValue: 20,
      centerControl: 5,
      advancementBonus: 3,
      jumpOpportunity: 15
    }
  },
  hard: {
    difficulty: 'hard',
    maxDepth: 6,
    useAlphaBeta: false,
    weights: {
      pieceValue: 10,
      kingValue: 25,
      centerControl: 7,
      advancementBonus: 4,
      jumpOpportunity: 20
    }
  }
};

interface AStarNode {
  board: Board;
  currentPlayer: Player;
  depth: number;
  firstMove: Move | null;
  g: number;
  h: number;
  f: number;
}

export interface AStarResult {
  move: Move | null;
  score: number;
  exploredNodes: number;
}

// Calcula el score heuristico del tablero.
export function evaluateBoard(
  board: Board,
  player: Player,
  config: AIConfig,
  variant: CheckersVariant = 'english'
): number {
  let score = 0;
  const { weights } = config;

  const size = board.length;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const piece = board[row][col];
      if (!piece) continue;

      const isPlayerPiece = piece.player === player;
      const baseScore = piece.isKing ? weights.kingValue : weights.pieceValue;
      let pieceScore = baseScore;

      const centerStart = Math.floor(size / 2) - 2;
      const centerEnd = Math.floor(size / 2) + 1;
      if (row >= centerStart && row <= centerEnd && col >= centerStart && col <= centerEnd) {
        pieceScore += weights.centerControl;
      }

      if (!piece.isKing) {
        if (piece.player === 'black') {
          pieceScore += row * weights.advancementBonus;
        } else {
          pieceScore += (size - 1 - row) * weights.advancementBonus;
        }
      }

      const possibleJumps = getJumpMoves(board, piece.player, variant);
      if (possibleJumps.some(jump => jump.from.row === row && jump.from.col === col)) {
        pieceScore += weights.jumpOpportunity;
      }

      score += isPlayerPiece ? pieceScore : -pieceScore;
    }
  }

  return score;
}

function boardKey(board: Board, currentPlayer: Player): string {
  const cells = board
    .flat()
    .map(piece => {
      if (!piece) return '_';
      return `${piece.player[0]}${piece.isKing ? 'K' : 'P'}${piece.id}`;
    })
    .join('|');
  return `${currentPlayer}:${cells}`;
}

function countPieces(board: Board, player: Player) {
  let count = 0;
  for (const row of board) {
    for (const piece of row) {
      if (piece?.player === player) count++;
    }
  }
  return count;
}

function promotionDistance(board: Board, player: Player) {
  let distance = 0;
  const size = board.length;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const piece = board[row][col];
      if (!piece || piece.player !== player || piece.isKing) continue;
      distance += player === 'black' ? size - 1 - row : row;
    }
  }
  return distance;
}

function difficultyGoalScore(config: AIConfig) {
  if (config.difficulty === 'easy') return 20;
  if (config.difficulty === 'medium') return 45;
  return 70;
}

// h(n): estimacion de distancia restante hacia un tablero favorable para la IA.
function estimateHeuristicCost(
  board: Board,
  aiPlayer: Player,
  config: AIConfig,
  variant: CheckersVariant
): number {
  const opponent = getOpponent(aiPlayer);
  const boardScore = evaluateBoard(board, aiPlayer, config, variant);
  const goalGap = Math.max(0, difficultyGoalScore(config) - boardScore);
  const materialGap = Math.max(0, countPieces(board, opponent) - countPieces(board, aiPlayer));
  const opponentCaptures = getJumpMoves(board, opponent, variant).length;
  const aiPromotionDistance = promotionDistance(board, aiPlayer);

  return goalGap
    + materialGap * config.weights.pieceValue
    + opponentCaptures * config.weights.jumpOpportunity
    + aiPromotionDistance * 0.5;
}

// g(n): costo acumulado. Movimientos buenos para la IA reducen el costo del camino;
// respuestas peligrosas del oponente lo aumentan.
function moveCost(
  boardAfterMove: Board,
  move: Move,
  movingPlayer: Player,
  aiPlayer: Player,
  config: AIConfig,
  variant: CheckersVariant
): number {
  const opponent = getOpponent(aiPlayer);
  const captureCount = move.capturedPieces?.length || 0;
  const opponentJumpThreats = getJumpMoves(boardAfterMove, opponent, variant).length;
  const score = evaluateBoard(boardAfterMove, aiPlayer, config, variant);
  const scorePressure = Math.max(0, -score / 20);

  if (movingPlayer === aiPlayer) {
    return Math.max(1, 12 - captureCount * 6 - score / 25 + opponentJumpThreats * 2);
  }

  return Math.max(1, 8 + captureCount * 5 + scorePressure);
}

function nodePriority(node: AStarNode) {
  return node.f;
}

function pushSorted(frontier: AStarNode[], node: AStarNode) {
  frontier.push(node);
  frontier.sort((a, b) => nodePriority(a) - nodePriority(b));
}

function isGoalNode(board: Board, currentPlayer: Player, aiPlayer: Player, config: AIConfig, variant: CheckersVariant) {
  const gameOver = checkGameOver(board, currentPlayer, variant);
  if (gameOver.isOver) return gameOver.winner === aiPlayer;
  return evaluateBoard(board, aiPlayer, config, variant) >= difficultyGoalScore(config);
}

function scoreCandidate(node: AStarNode, aiPlayer: Player, config: AIConfig, variant: CheckersVariant) {
  const gameOver = checkGameOver(node.board, node.currentPlayer, variant);
  const terminalBonus = gameOver.winner === aiPlayer ? 1000 : gameOver.isOver ? -1000 : 0;
  return evaluateBoard(node.board, aiPlayer, config, variant) + terminalBonus - node.g * 0.1 - node.depth;
}

export function aStarSearch(
  board: Board,
  difficulty: Difficulty = 'medium',
  aiPlayer: Player = 'red',
  variant: CheckersVariant = 'english'
): AStarResult {
  const config = AI_CONFIGS[difficulty];
  const startH = estimateHeuristicCost(board, aiPlayer, config, variant);
  const frontier: AStarNode[] = [{
    board,
    currentPlayer: aiPlayer,
    depth: 0,
    firstMove: null,
    g: 0,
    h: startH,
    f: startH
  }];
  const visited = new Map<string, number>();
  let exploredNodes = 0;
  let bestNode: AStarNode | null = null;
  let bestScore = -Infinity;
  const maxNodes = difficulty === 'easy' ? 80 : difficulty === 'medium' ? 250 : 700;

  while (frontier.length > 0 && exploredNodes < maxNodes) {
    const node = frontier.shift()!;
    exploredNodes++;

    const key = boardKey(node.board, node.currentPlayer);
    const previousBestCost = visited.get(key);
    if (previousBestCost !== undefined && previousBestCost <= node.g) continue;
    visited.set(key, node.g);

    if (node.firstMove) {
      const candidateScore = scoreCandidate(node, aiPlayer, config, variant);
      if (candidateScore > bestScore) {
        bestScore = candidateScore;
        bestNode = node;
      }
    }

    if (node.firstMove && isGoalNode(node.board, node.currentPlayer, aiPlayer, config, variant)) {
      return {
        move: node.firstMove,
        score: scoreCandidate(node, aiPlayer, config, variant),
        exploredNodes
      };
    }

    if (node.depth >= config.maxDepth) continue;

    const moves = getLegalMoves(node.board, node.currentPlayer, variant);
    for (const move of moves) {
      const nextBoard = applyMove(node.board, move, node.currentPlayer, variant);
      const nextPlayer = getOpponent(node.currentPlayer);
      const firstMove = node.firstMove || move;
      const g = node.g + moveCost(nextBoard, move, node.currentPlayer, aiPlayer, config, variant);
      const h = estimateHeuristicCost(nextBoard, aiPlayer, config, variant);

      pushSorted(frontier, {
        board: nextBoard,
        currentPlayer: nextPlayer,
        depth: node.depth + 1,
        firstMove,
        g,
        h,
        f: g + h
      });
    }
  }

  return {
    move: bestNode?.firstMove || getLegalMoves(board, aiPlayer, variant)[0] || null,
    score: bestScore,
    exploredNodes
  };
}

// Seleccionar el mejor movimiento usando A*.
export function calculateBestMove(
  board: Board,
  difficulty: Difficulty = 'medium',
  aiPlayer: Player = 'red',
  variant: CheckersVariant = 'english'
): Move | null {
  return aStarSearch(board, difficulty, aiPlayer, variant).move;
}
