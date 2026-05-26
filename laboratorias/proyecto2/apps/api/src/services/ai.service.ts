import type { Board, Piece, Player, Move, AIConfig, Difficulty, Position } from '@checkers/shared';
import { BOARD_SIZE } from '@checkers/shared';
import {
  getLegalMoves,
  applyMove,
  getOpponent,
  isValidPosition,
  getMoveDirections,
  getJumpMoves
} from './game.service';

// Configuraciones de IA por dificultad
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
    useAlphaBeta: true,
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
    useAlphaBeta: true,
    weights: {
      pieceValue: 10,
      kingValue: 25,
      centerControl: 7,
      advancementBonus: 4,
      jumpOpportunity: 20
    }
  }
};

interface EvaluateResult {
  score: number;
  move: Move | null;
}

// Calcula el score heurístico del tablero
export function evaluateBoard(board: Board, player: Player, config: AIConfig): number {
  let score = 0;
  const opponent = getOpponent(player);
  const { weights } = config;

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const piece = board[row][col];
      if (!piece) continue;

      const isPlayerPiece = piece.player === player;
      const baseScore = piece.isKing ? weights.kingValue : weights.pieceValue;

      // Valor de la pieza
      let pieceScore = baseScore;

      // Control del centro (4x4 central)
      if (row >= 2 && row <= 5 && col >= 2 && col <= 5) {
        pieceScore += weights.centerControl;
      }

      // Avance hacia coronación
      if (!piece.isKing) {
        if (player === 'black') {
          pieceScore += row * weights.advancementBonus;
        } else {
          pieceScore += (BOARD_SIZE - 1 - row) * weights.advancementBonus;
        }
      }

      // Oportunidades de captura
      const possibleJumps = getJumpMoves(board, piece.player);
      if (possibleJumps.some(j => j.from.row === row && j.from.col === col)) {
        pieceScore += weights.jumpOpportunity;
      }

      if (isPlayerPiece) {
        score += pieceScore;
      } else {
        score -= pieceScore;
      }
    }
  }

  return score;
}

// Minimax con Alpha-Beta pruning
export function minimax(
  board: Board,
  depth: number,
  useAlphaBeta: boolean,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  aiPlayer: Player,
  config: AIConfig
): EvaluateResult {
  const currentPlayer = isMaximizing ? aiPlayer : getOpponent(aiPlayer);
  const moves = getLegalMoves(board, currentPlayer);

  // Caso base: profundidad 0 o sin movimientos
  if (depth === 0 || moves.length === 0) {
    return {
      score: evaluateBoard(board, aiPlayer, config),
      move: null
    };
  }

  let bestMove: Move | null = null;

  if (isMaximizing) {
    let maxEval = -Infinity;

    for (const move of moves) {
      const newBoard = applyMove(board, move, currentPlayer);
      const result = minimax(newBoard, depth - 1, useAlphaBeta, alpha, beta, false, aiPlayer, config);

      if (result.score > maxEval) {
        maxEval = result.score;
        bestMove = move;
      }

      if (useAlphaBeta) {
        alpha = Math.max(alpha, result.score);
        if (beta <= alpha) break; // Beta pruning
      }
    }

    return { score: maxEval, move: bestMove };
  } else {
    let minEval = Infinity;

    for (const move of moves) {
      const newBoard = applyMove(board, move, currentPlayer);
      const result = minimax(newBoard, depth - 1, useAlphaBeta, alpha, beta, true, aiPlayer, config);

      if (result.score < minEval) {
        minEval = result.score;
        bestMove = move;
      }

      if (useAlphaBeta) {
        beta = Math.min(beta, result.score);
        if (beta <= alpha) break; // Alpha pruning
      }
    }

    return { score: minEval, move: bestMove };
  }
}

// Seleccionar el mejor movimiento usando IA
export function calculateBestMove(
  board: Board,
  difficulty: Difficulty = 'medium'
): Move | null {
  const config = AI_CONFIGS[difficulty];
  const aiPlayer: Player = 'red'; // La IA juega con rojas

  // Primero verificar si hay movimientos de captura obligatorios
  const jumpMoves = getJumpMoves(board, aiPlayer);
  if (jumpMoves.length > 0) {
    // Para captures, usar versión simplificada
    const result = minimax(
      board,
      config.maxDepth,
      config.useAlphaBeta,
      -Infinity,
      Infinity,
      true,
      aiPlayer,
      config
    );
    return result.move;
  }

  // Calcular mejor movimiento con minimax
  const result = minimax(
    board,
    config.maxDepth,
    config.useAlphaBeta,
    -Infinity,
    Infinity,
    true,
    aiPlayer,
    config
  );

  return result.move;
}

// Verificar si hay multijump disponible después de un salto
export function getMultiJumps(board: Board, player: Player, fromPos: Position): Move[] {
  const piece = board[fromPos.row][fromPos.col];
  if (!piece || piece.player !== player) return [];

  const moves: Move[] = [];
  const directions = getMoveDirections(piece.player, piece.isKing);

  for (const dir of directions) {
    const midRow = fromPos.row + dir.row;
    const midCol = fromPos.col + dir.col;
    const jumpRow = fromPos.row + dir.row * 2;
    const jumpCol = fromPos.col + dir.col * 2;

    if (
      isValidPosition(jumpRow, jumpCol) &&
      !board[jumpRow][jumpCol] &&
      board[midRow]?.[midCol]?.player !== player
    ) {
      moves.push({
        from: fromPos,
        to: { row: jumpRow, col: jumpCol },
        isJump: true,
        capturedPieces: [{ row: midRow, col: midCol }]
      });
    }
  }

  return moves;
}
