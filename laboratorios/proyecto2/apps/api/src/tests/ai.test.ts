import { describe, it, expect } from 'vitest';
import { calculateBestMove, evaluateBoard, AI_CONFIGS } from '../services/ai.service';
import { createInitialBoard } from '../services/game.service';

describe('AI Service', () => {
  it('should return a valid move', () => {
    const board = createInitialBoard();
    const move = calculateBestMove(board, 'easy');

    expect(move).not.toBeNull();
    expect(move?.from).toBeDefined();
    expect(move?.to).toBeDefined();
  });

  it('should use correct depth for each difficulty', () => {
    expect(AI_CONFIGS.easy.maxDepth).toBe(2);
    expect(AI_CONFIGS.medium.maxDepth).toBe(4);
    expect(AI_CONFIGS.hard.maxDepth).toBe(6);
  });

  it('should use alpha-beta only for medium and hard', () => {
    expect(AI_CONFIGS.easy.useAlphaBeta).toBe(false);
    expect(AI_CONFIGS.medium.useAlphaBeta).toBe(true);
    expect(AI_CONFIGS.hard.useAlphaBeta).toBe(true);
  });

  it('should evaluate board score', () => {
    const board = createInitialBoard();
    const score = evaluateBoard(board, 'black', AI_CONFIGS.easy);

    expect(typeof score).toBe('number');
  });
});
