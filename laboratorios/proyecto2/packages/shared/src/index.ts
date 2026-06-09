// Tipos compartidos para Checkers

export type Player = 'red' | 'black';
export type GameStatus = 'waiting' | 'playing' | 'won' | 'draw';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type GameMode = 'pvp' | 'pva';
export type CheckersVariant = 'international' | 'spanish' | 'english' | 'turkish' | 'russian';

export interface Position {
  row: number;
  col: number;
}

export interface Piece {
  player: Player;
  isKing: boolean;
  id: string;
}

export type Board = (Piece | null)[][];

export interface Move {
  from: Position;
  to: Position;
  isJump: boolean;
  capturedPieces?: Position[];
}

export interface GameState {
  id: string;
  board: Board;
  currentPlayer: Player;
  moveCount: number;
  capturedPieces: { red: number; black: number };
  status: GameStatus;
  difficulty?: Difficulty;
  gameMode: GameMode;
  checkersVariant?: CheckersVariant;
  winner?: Player;
}

export interface RankingEntry {
  id: number;
  username: string;
  moves: number;
  difficulty: Difficulty;
  gameMode: GameMode;
  result?: 'victory' | 'defeat';
  checkersVariant?: CheckersVariant;
  createdAt: Date;
  deviceHash?: string;
  clerkId?: string;
}

export interface AIConfig {
  difficulty: Difficulty;
  maxDepth: number;
  useAlphaBeta: boolean;
  weights: AIWeights;
}

export interface AIWeights {
  pieceValue: number;
  kingValue: number;
  centerControl: number;
  advancementBonus: number;
  jumpOpportunity: number;
}

export interface HealthStatus {
  service: string;
  status: 'healthy' | 'unhealthy';
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

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

// Constantes del tablero
export const BOARD_SIZE = 8;
export const INITIAL_RED_ROWS = 3;
export const INITIAL_BLACK_ROWS = 3;
