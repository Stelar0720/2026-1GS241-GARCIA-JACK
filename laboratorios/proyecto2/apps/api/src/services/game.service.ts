import type { Board, Piece, Player, Move, GameState, Position, CheckersVariant } from '@checkers/shared';
import { BOARD_SIZE, INITIAL_RED_ROWS, INITIAL_BLACK_ROWS } from '@checkers/shared';
import { v4 as uuidv4 } from 'uuid';

function getVariantBoardSize(variant: CheckersVariant = 'english') {
  return variant === 'international' ? 10 : 8;
}

function getVariantInitialRows(variant: CheckersVariant = 'english') {
  if (variant === 'international') return 4;
  if (variant === 'turkish') return 2;
  return 3;
}

function isInsideBoard(board: Board, row: number, col: number): boolean {
  return row >= 0 && row < board.length && col >= 0 && col < board[row].length;
}

// Crear tablero inicial
export function createInitialBoard(variant: CheckersVariant = 'english'): Board {
  const size = getVariantBoardSize(variant);
  const initialRows = getVariantInitialRows(variant);
  const board: Board = Array(size)
    .fill(null)
    .map(() => Array(size).fill(null));

  let pieceId = 0;

  // Colocar fichas negras (arriba)
  for (let row = variant === 'turkish' ? 1 : 0; row < (variant === 'turkish' ? 1 + initialRows : initialRows); row++) {
    for (let col = 0; col < size; col++) {
      if (variant === 'turkish' || (row + col) % 2 === 1) {
        board[row][col] = {
          player: 'black',
          isKing: false,
          id: `black-${pieceId++}`
        };
      }
    }
  }

  // Colocar fichas rojas (abajo)
  const redStart = variant === 'turkish' ? size - 1 - initialRows : size - initialRows;
  const redEnd = variant === 'turkish' ? size - 1 : size;
  for (let row = redStart; row < redEnd; row++) {
    for (let col = 0; col < size; col++) {
      if (variant === 'turkish' || (row + col) % 2 === 1) {
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
export function createGameState(
  difficulty?: string,
  gameMode: 'pvp' | 'pva' = 'pva',
  checkersVariant: CheckersVariant = 'english'
): GameState {
  return {
    id: uuidv4(),
    board: createInitialBoard(checkersVariant),
    currentPlayer: 'black', // negras mueven primero
    moveCount: 0,
    capturedPieces: { red: 0, black: 0 },
    status: 'playing',
    difficulty: difficulty as any,
    gameMode,
    checkersVariant,
    winner: undefined
  };
}

// Verificar si una posición es válida
export function isValidPosition(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function diagonalDirections(): Position[] {
  return [
    { row: -1, col: -1 },
    { row: -1, col: 1 },
    { row: 1, col: -1 },
    { row: 1, col: 1 }
  ];
}

function orthogonalDirections(): Position[] {
  return [
    { row: -1, col: 0 },
    { row: 1, col: 0 },
    { row: 0, col: -1 },
    { row: 0, col: 1 }
  ];
}

function forwardDirections(player: Player, variant: CheckersVariant): Position[] {
  const forward = player === 'red' ? -1 : 1;
  if (variant === 'turkish') {
    return [
      { row: forward, col: 0 },
      { row: 0, col: -1 },
      { row: 0, col: 1 }
    ];
  }

  return [
    { row: forward, col: -1 },
    { row: forward, col: 1 }
  ];
}

function getMoveDirections(player: Player, isKing: boolean, variant: CheckersVariant): Position[] {
  if (variant === 'turkish') {
    return isKing ? orthogonalDirections() : forwardDirections(player, variant);
  }

  return isKing ? diagonalDirections() : forwardDirections(player, variant);
}

function getCaptureDirections(player: Player, isKing: boolean, variant: CheckersVariant): Position[] {
  if (variant === 'turkish') {
    return isKing ? orthogonalDirections() : forwardDirections(player, variant);
  }

  if (isKing || variant === 'international' || variant === 'russian') {
    return diagonalDirections();
  }

  return forwardDirections(player, variant);
}

function hasFlyingKings(variant: CheckersVariant): boolean {
  return variant === 'international' || variant === 'spanish' || variant === 'russian' || variant === 'turkish';
}

// Obtener movimientos simples posibles
export function getSimpleMoves(board: Board, player: Player, variant: CheckersVariant = 'english'): Move[] {
  const moves: Move[] = [];

  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const piece = board[row][col];
      if (piece && piece.player === player) {
        const directions = getMoveDirections(piece.player, piece.isKing, variant);

        for (const dir of directions) {
          if (piece.isKing && hasFlyingKings(variant)) {
            let newRow = row + dir.row;
            let newCol = col + dir.col;
            while (isInsideBoard(board, newRow, newCol) && !board[newRow][newCol]) {
              moves.push({
                from: { row, col },
                to: { row: newRow, col: newCol },
                isJump: false
              });
              newRow += dir.row;
              newCol += dir.col;
            }
            continue;
          }

          const newRow = row + dir.row;
          const newCol = col + dir.col;
          if (isInsideBoard(board, newRow, newCol) && !board[newRow][newCol]) {
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

function getSingleJumpMovesForPiece(board: Board, row: number, col: number, variant: CheckersVariant): Move[] {
  const moves: Move[] = [];
  const piece = board[row]?.[col];
  if (!piece) return moves;

  const directions = getCaptureDirections(piece.player, piece.isKing, variant);

  for (const dir of directions) {
    if (piece.isKing && hasFlyingKings(variant)) {
      let scanRow = row + dir.row;
      let scanCol = col + dir.col;

      while (isInsideBoard(board, scanRow, scanCol) && !board[scanRow][scanCol]) {
        scanRow += dir.row;
        scanCol += dir.col;
      }

      const jumpedPiece = board[scanRow]?.[scanCol];
      if (!jumpedPiece || jumpedPiece.player === piece.player) continue;

      let landingRow = scanRow + dir.row;
      let landingCol = scanCol + dir.col;
      while (isInsideBoard(board, landingRow, landingCol) && !board[landingRow][landingCol]) {
        moves.push({
          from: { row, col },
          to: { row: landingRow, col: landingCol },
          isJump: true,
          capturedPieces: [{ row: scanRow, col: scanCol }]
        });
        landingRow += dir.row;
        landingCol += dir.col;
      }
      continue;
    }

    const midRow = row + dir.row;
    const midCol = col + dir.col;
    const jumpRow = row + dir.row * 2;
    const jumpCol = col + dir.col * 2;
    const jumpedPiece = board[midRow]?.[midCol];

    if (
      isInsideBoard(board, jumpRow, jumpCol) &&
      !board[jumpRow][jumpCol] &&
      jumpedPiece &&
      jumpedPiece.player !== piece.player
    ) {
      moves.push({
        from: { row, col },
        to: { row: jumpRow, col: jumpCol },
        isJump: true,
        capturedPieces: [{ row: midRow, col: midCol }]
      });
    }
  }

  return moves;
}

function getJumpSequencesForPiece(board: Board, row: number, col: number, variant: CheckersVariant): Move[] {
  const piece = board[row]?.[col];
  if (!piece) return [];

  const singleJumps = getSingleJumpMovesForPiece(board, row, col, variant);
  if (singleJumps.length === 0) return [];

  const sequences: Move[] = [];

  for (const jump of singleJumps) {
    const nextBoard = applyMove(board, jump, piece.player, variant, false);
    const nextJumps = getJumpSequencesForPiece(nextBoard, jump.to.row, jump.to.col, variant);

    if (nextJumps.length === 0) {
      sequences.push(jump);
    } else {
      for (const nextJump of nextJumps) {
        sequences.push({
          from: jump.from,
          to: nextJump.to,
          isJump: true,
          capturedPieces: [
            ...(jump.capturedPieces || []),
            ...(nextJump.capturedPieces || [])
          ]
        });
      }
    }
  }

  return sequences;
}

// Obtener saltos (capturas) posibles
export function getJumpMoves(board: Board, player: Player, variant: CheckersVariant = 'english'): Move[] {
  const moves: Move[] = [];

  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const piece = board[row][col];
      if (piece && piece.player === player) {
        moves.push(...getJumpSequencesForPiece(board, row, col, variant));
      }
    }
  }

  if (moves.length === 0) return moves;

  const maxCaptures = Math.max(...moves.map(move => move.capturedPieces?.length || 0));
  if (variant === 'international' || variant === 'spanish') {
    return moves.filter(move => (move.capturedPieces?.length || 0) === maxCaptures);
  }

  return moves;
}

// Obtener todos los movimientos legales
export function getLegalMoves(board: Board, player: Player, variant: CheckersVariant = 'english'): Move[] {
  // Primero verificar si hay saltos obligatorios
  const jumpMoves = getJumpMoves(board, player, variant);
  if (jumpMoves.length > 0) {
    return jumpMoves;
  }

  // Si no hay saltos, retornar movimientos simples
  return getSimpleMoves(board, player, variant);
}

// Verificar si hay coronación
function checkPromotion(board: Board, move: Move, player: Player): boolean {
  const { row } = move.to;
  const lastRow = board.length - 1;
  return player === 'red'
    ? row === 0 // Las rojas coronan al llegar arriba
    : row === lastRow; // Las negras coronan al llegar abajo
}

// Aplicar un movimiento al tablero
export function applyMove(
  board: Board,
  move: Move,
  player: Player,
  variant: CheckersVariant = 'english',
  promote: boolean = true
): Board {
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
  if (promote && !piece.isKing && checkPromotion(board, move, player)) {
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

export function checkGameOver(board: Board, currentPlayer: Player, variant: CheckersVariant = 'english'): {
  isOver: boolean;
  winner?: Player;
  status: 'won' | 'draw' | 'playing';
} {
  const opponent = getOpponent(currentPlayer);
  const playerMoves = getLegalMoves(board, currentPlayer, variant);
  const opponentMoves = getLegalMoves(board, opponent, variant);

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
