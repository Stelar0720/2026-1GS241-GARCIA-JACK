import { describe, it, expect } from 'vitest';
import {
  createInitialBoard,
  createGameState,
  getLegalMoves,
  applyMove,
  checkGameOver
} from '../services/game.service';

describe('Checkers Game Logic', () => {
  it('should create initial board with correct number of pieces', () => {
    const board = createInitialBoard();
    let blackPieces = 0;
    let redPieces = 0;

    for (const row of board) {
      for (const cell of row) {
        if (cell) {
          if (cell.player === 'black') blackPieces++;
          else redPieces++;
        }
      }
    }

    expect(blackPieces).toBe(12);
    expect(redPieces).toBe(12);
  });

  it('should create international board with 10x10 and 20 pieces per player', () => {
    const board = createInitialBoard('international');
    const pieces = board.flat().filter(Boolean);

    expect(board.length).toBe(10);
    expect(board[0].length).toBe(10);
    expect(pieces.filter(piece => piece?.player === 'black').length).toBe(20);
    expect(pieces.filter(piece => piece?.player === 'red').length).toBe(20);
  });

  it('should create turkish board with orthogonal 16 pieces per player setup', () => {
    const board = createInitialBoard('turkish');
    const pieces = board.flat().filter(Boolean);

    expect(board.length).toBe(8);
    expect(pieces.filter(piece => piece?.player === 'black').length).toBe(16);
    expect(pieces.filter(piece => piece?.player === 'red').length).toBe(16);
  });

  it('should create game state with correct initial values', () => {
    const game = createGameState('medium', 'pva');

    expect(game.board).toBeDefined();
    expect(game.currentPlayer).toBe('black');
    expect(game.moveCount).toBe(0);
    expect(game.status).toBe('playing');
    expect(game.gameMode).toBe('pva');
  });

  it('should have legal moves for black player at start', () => {
    const board = createInitialBoard();
    const moves = getLegalMoves(board, 'black');

    expect(moves.length).toBeGreaterThan(0);
  });

  it('should apply a move correctly', () => {
    const board = createInitialBoard();
    const move = {
      from: { row: 2, col: 1 },
      to: { row: 3, col: 0 },
      isJump: false
    };

    const newBoard = applyMove(board, move, 'black');

    expect(newBoard[3][0]).toBeDefined();
    expect(newBoard[3][0]?.player).toBe('black');
    expect(newBoard[2][1]).toBeNull();
  });

  it('should detect game over when all pieces captured', () => {
    // Tablero con solo una ficha negra
    const board = [
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, { player: 'red', isKing: false, id: 'r1' }, null, null, null, null]
    ];

    const result = checkGameOver(board, 'black');

    expect(result.isOver).toBe(true);
    expect(result.status).toBe('won');
  });
});
