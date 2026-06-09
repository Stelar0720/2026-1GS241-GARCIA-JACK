import { describe, it, expect } from 'vitest';
import { aStarSearch, calculateBestMove, evaluateBoard, AI_CONFIGS } from '../services/ai.service';
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

  it('should use A* instead of alpha-beta', () => {
    expect(AI_CONFIGS.easy.useAlphaBeta).toBe(false);
    expect(AI_CONFIGS.medium.useAlphaBeta).toBe(false);
    expect(AI_CONFIGS.hard.useAlphaBeta).toBe(false);
  });

  it('should expose A* search metadata', () => {
    const board = createInitialBoard();
    const result = aStarSearch(board, 'medium');

    expect(result.move).not.toBeNull();
    expect(result.exploredNodes).toBeGreaterThan(0);
    expect(typeof result.score).toBe('number');
  });

  it('should evaluate board score', () => {
    const board = createInitialBoard();
    const score = evaluateBoard(board, 'black', AI_CONFIGS.easy);

    expect(typeof score).toBe('number');
  });
});
