// Tipos para el cliente
export type { 
  Player, 
  GameStatus, 
  Difficulty, 
  GameMode, 
  Position, 
  Piece, 
  Board, 
  Move, 
  GameState, 
  RankingEntry,
  AIConfig,
  AIWeights,
  HealthStatus
} from '@checkers/shared';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface InitGameRequest {
  difficulty?: Difficulty;
  gameMode?: GameMode;
  username?: string;
}

export interface InitGameResponse {
  success: boolean;
  gameId: string;
  game: GameState;
  username?: string;
}

export interface MoveRequest {
  gameId: string;
  move: Move;
  username?: string;
}

export interface MoveResponse {
  success: boolean;
  game: GameState;
  playerMove: Move | null;
  aiMove: Move | null;
}

export interface RankingRequest {
  username: string;
  moves: number;
  difficulty: Difficulty;
  gameMode: GameMode;
}

export interface DifficultyOption {
  value: Difficulty;
  label: string;
  description: string;
}
