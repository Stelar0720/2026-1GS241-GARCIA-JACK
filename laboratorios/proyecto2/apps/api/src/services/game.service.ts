import type { Board, Piece, Player, Move, GameState, Position } from '@checkers/shared';
import { BOARD_SIZE, INITIAL_RED_ROWS, INITIAL_BLACK_ROWS } from '@checkers/shared';
import { v4 as uuidv4 } from 'uuid';

// Crear tablero inicial
export function createInitialBoard(): Board {
  const board: Board = Array(BOARD_SIZE)
    .fill(null)
    .map(() => Array(BOARD_SIZE).fill(null));

  let pieceId = 0;

  // Colocar fichas negras (arriba)
  for (let row = 0; row < INITIAL_BLACK_ROWS; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if ((row + col) % 2 === 1) {
        board[row][col] = {
          player: 'black',
          isKing: false,
          id: `black-${pieceId++}`
        };
      }
    }
  }

  // Colocar fichas rojas (abajo)
  for (let row = BOARD_SIZE - INITIAL_RED_ROWS; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if ((row + col) % 2 === 1) {
        board[row][col] = {
          player: 'red',
          isKing: false,
          id: `red-${pieceId++}`
        };
      }
    }
  }

  return board;
}

// Crear estado inicial del juego
export function createGameState(difficulty?: string, gameMode: 'pvp' | 'pva' = 'pva'): GameState {
  return {
    id: uuidv4(),
    board: createInitialBoard(),
    currentPlayer: 'black', // negras mueven primero
    moveCount: 0,
    capturedPieces: { red: 0, black: 0 },
    status: 'playing',
    difficulty: difficulty as any,
    gameMode,
    winner: undefined
  };
}

// Verificar si una posición es válida
export function isValidPosition(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

// Obtener las direcciones de movimiento para cada jugador
function getMoveDirections(player: Player, isKing: boolean): Position[] {
  if (isKing) {
    return [
      { row: -1, col: -1 },
      { row: -1, col: 1 },
      { row: 1, col: -1 },
      { row: 1, col: 1 }
    ];
  }
  // Las rojas van hacia arriba (row--), las negras hacia abajo (row++)
  return player === 'red'
    ? [
        { row: -1, col: -1 },
        { row: -1, col: 1 }
      ]
    : [
        { row: 1, col: -1 },
        { row: 1, col: 1 }
      ];
}

// Obtener movimientos simples posibles
export function getSimpleMoves(board: Board, player: Player): Move[] {
  const moves: Move[] = [];

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const piece = board[row][col];
      if (piece && piece.player === player) {
        const directions = getMoveDirections(piece.player, piece.isKing);

        for (const dir of directions) {
          const newRow = row + dir.row;
          const newCol = col + dir.col;

          if (isValidPosition(newRow, newCol) && !board[newRow][newCol]) {
            moves.push({
              from: { row, col },
              to: { row: newRow, col: newCol },
              isJump: false
            });
          }
        }
      }
    }
  }

  return moves;
}

// Obtener saltos (capturas) posibles
export function getJumpMoves(board: Board, player: Player): Move[] {
  const moves: Move[] = [];

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const piece = board[row][col];
      if (piece && piece.player === player) {
        const directions = getMoveDirections(piece.player, piece.isKing);

        for (const dir of directions) {
          const midRow = row + dir.row;
          const midCol = col + dir.col;
          const jumpRow = row + dir.row * 2;
          const jumpCol = col + dir.col * 2;
          const jumpedPiece = board[midRow]?.[midCol];

          if (
            isValidPosition(jumpRow, jumpCol) &&
            !board[jumpRow][jumpCol] &&
            jumpedPiece &&
            jumpedPiece.player !== player
          ) {
            moves.push({
              from: { row, col },
              to: { row: jumpRow, col: jumpCol },
              isJump: true,
              capturedPieces: [{ row: midRow, col: midCol }]
            });
          }
        }
      }
    }
  }

  return moves;
}

// Obtener todos los movimientos legales
export function getLegalMoves(board: Board, player: Player): Move[] {
  // Primero verificar si hay saltos obligatorios
  const jumpMoves = getJumpMoves(board, player);
  if (jumpMoves.length > 0) {
    return jumpMoves;
  }

  // Si no hay saltos, retornar movimientos simples
  return getSimpleMoves(board, player);
}

// Verificar si hay coronación
function checkPromotion(board: Board, move: Move, player: Player): boolean {
  const { row } = move.to;
  return player === 'red'
    ? row === 0 // Las rojas coronan al llegar arriba
    : row === BOARD_SIZE - 1; // Las negras coronan al llegar abajo
}

// Aplicar un movimiento al tablero
export function applyMove(board: Board, move: Move, player: Player): Board {
  const newBoard: Board = board.map(r => r.map(c => c));

  const piece = newBoard[move.from.row][move.from.col];
  if (!piece) return newBoard;

  // Mover la pieza
  newBoard[move.to.row][move.to.col] = { ...piece };
  newBoard[move.from.row][move.from.col] = null;

  // Remover piezas capturadas
  if (move.capturedPieces) {
    for (const pos of move.capturedPieces) {
      newBoard[pos.row][pos.col] = null;
    }
  }

  // Verificar coronación
  if (!piece.isKing && checkPromotion(board, move, player)) {
    newBoard[move.to.row][move.to.col] = {
      ...newBoard[move.to.row][move.to.col]!,
      isKing: true
    };
  }

  return newBoard;
}

// Verificar si el juego ha terminado
export function getOpponent(player: Player): Player {
  return player === 'red' ? 'black' : 'red';
}

export function checkGameOver(board: Board, currentPlayer: Player): {
  isOver: boolean;
  winner?: Player;
  status: 'won' | 'draw' | 'playing';
} {
  const opponent = getOpponent(currentPlayer);
  const playerMoves = getLegalMoves(board, currentPlayer);
  const opponentMoves = getLegalMoves(board, opponent);

  const playerHasPieces = board.some(row =>
    row.some(cell => cell?.player === currentPlayer)
  );
  const opponentHasPieces = board.some(row =>
    row.some(cell => cell?.player === opponent)
  );

  // Victoria por captura total
  if (!opponentHasPieces) {
    return { isOver: true, winner: currentPlayer, status: 'won' };
  }

  // Victoria por inmovilización
  if (playerMoves.length === 0 && opponentMoves.length > 0) {
    return { isOver: true, winner: opponent, status: 'won' };
  }

  // Empate por bloqueo mutuo
  if (playerMoves.length === 0 && opponentMoves.length === 0) {
    return { isOver: true, status: 'draw' };
  }

  return { isOver: false, status: 'playing' };
}

// Serializar tablero para almacenamiento
export function serializeBoard(board: Board): string {
  return JSON.stringify(board);
}

// Deserializar tablero
export function deserializeBoard(serialized: string): Board {
  return JSON.parse(serialized);
}

// Contar fichas de cada jugador
export function countPieces(board: Board): { red: number; black: number } {
  let red = 0;
  let black = 0;

  for (const row of board) {
    for (const cell of row) {
      if (cell) {
        if (cell.player === 'red') red++;
        else black++;
      }
    }
  }

  return { red, black };
}
