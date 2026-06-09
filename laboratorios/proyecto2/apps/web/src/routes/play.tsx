import { useState, useEffect, useCallback } from 'react';
import { Link } from '@tanstack/react-start';
import { createRootRoute } from '@tanstack/react-start';
import { GameBoard } from '~/components/Board';
import { GameOverModal } from '~/components/GameOverModal';
import { TutorialModal } from '~/components/TutorialModal';
import type { GameState, Move, Position, Difficulty, CheckersVariant, Player } from '~/lib/api-client';

export const Route = createRootRoute({
  component: GamePage,
});

function GamePage() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedPiece, setSelectedPiece] = useState<Position | null>(null);
  const [validMoves, setValidMoves] = useState<Move[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showGameOver, setShowGameOver] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);

  // Obtener parrafos de la URL
  const params = new URLSearchParams(window.location.search);
  const difficulty = (params.get('difficulty') || 'medium') as Difficulty;
  const username = params.get('username') || 'Jugador';
  const isGuest = params.get('guest') === 'true';
  const clerkId = params.get('clerkId') || undefined;
  const checkersVariant = (params.get('checkersVariant') || 'english') as CheckersVariant;
  const playerColor = (params.get('playerColor') || 'black') as Player;

  // Inicializar juego
  const initGame = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:3001/game/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty, gameMode: 'pva', username, checkersVariant, playerColor })
      });

      if (!response.ok) throw new Error('Error al iniciar el juego');

      const data = await response.json();
      setGameState(data.game);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setLoading(false);
    }
  }, [difficulty, username, checkersVariant, playerColor]);

  useEffect(() => {
    initGame();

    setTimeout(() => setShowTutorial(true), 500);
  }, [initGame]);

  // Manejar clic en celda
  const handleCellClick = async (row: number, col: number) => {
    if (!gameState || isAiThinking) return;
    if (gameState.status !== 'playing') return;

    const piece = gameState.board[row][col];

    if (selectedPiece) {
      const validMove = validMoves.find(m => m.to.row === row && m.to.col === col);
      if (validMove) {
        await makeMove(validMove);
        return;
      }
    }

    if (piece && piece.player === gameState.currentPlayer) {
      setSelectedPiece({ row, col });
      setValidMoves(calculateValidMoves(gameState.board, row, col, piece.player));
    } else {
      setSelectedPiece(null);
      setValidMoves([]);
    }
  };

  // Calcular movimientos validos
  const calculateValidMoves = (board: any[][], row: number, col: number, player: string): Move[] => {
    const moves: Move[] = [];
    const directions = player === 'red' ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];

    for (const [dr, dc] of directions) {
      const newRow = row + dr;
      const newCol = col + dc;
      
      if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
        if (!board[newRow][newCol]) {
          moves.push({
            from: { row, col },
            to: { row: newRow, col: newCol },
            isJump: false
          });
        } else if (board[newRow][newCol]?.player !== player) {
          const jumpRow = newRow + dr;
          const jumpCol = newCol + dc;
          if (jumpRow >= 0 && jumpRow < 8 && jumpCol >= 0 && jumpCol < 8 && !board[jumpRow][jumpCol]) {
            moves.push({
              from: { row, col },
              to: { row: jumpRow, col: jumpCol },
              isJump: true,
              capturedPieces: [{ row: newRow, col: newCol }]
            });
          }
        }
      }
    }

    return moves;
  };

  // Realizar movimiento
  const makeMove = async (move: Move) => {
    if (!gameState) return;

    try {
      setIsAiThinking(true);
      const response = await fetch(`http://localhost:3001/game/move`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(clerkId && { 'x-clerk-id': clerkId })
        },
        body: JSON.stringify({
          gameId: gameState.id,
          move,
          username,
          playerColor,
          checkersVariant
        })
      });

      if (!response.ok) throw new Error('Error al realizar movimiento');

      const data = await response.json();
      setGameState(data.game);
      setSelectedPiece(null);
      setValidMoves([]);

      if (data.game.status === 'won' || data.game.status === 'draw') {
        setShowGameOver(true);
      }

      setIsAiThinking(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
      setIsAiThinking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="peak-paper peak-border p-8 text-center">
          <p className="peak-text text-xl">Cargando tablero...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="peak-paper peak-border p-8 text-center">
          <p className="peak-text text-red-600">Error: {error}</p>
          <Link to="/" className="peak-button mt-4 inline-block">Volver al Inicio</Link>
        </div>
      </div>
    );
  }

  if (!gameState) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-100 to-amber-200 p-4">
      {showTutorial && (
        <TutorialModal onClose={() => setShowTutorial(false)} onSkip={() => setShowTutorial(false)} />
      )}

      {showGameOver && (
        <GameOverModal
          winner={gameState.winner || null}
          moveCount={gameState.moveCount}
          username={username}
          onPlayAgain={() => {
            setShowGameOver(false);
            setSelectedPiece(null);
            setValidMoves([]);
            initGame();
          }}
          onGoHome={() => { window.location.href = '/'; }}
        />
      )}

      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Link to="/" className="peak-button text-sm">Salir</Link>
          <div className="peak-paper peak-border px-4 py-2">
            <p className="peak-text">Jugador: {username}</p>
            <p className="peak-text">Movimientos: {gameState.moveCount}</p>
          </div>
          <div className="peak-paper peak-border px-4 py-2">
            <p className="peak-text text-sm">Dificultad: {difficulty.toUpperCase()}</p>
          </div>
        </div>

        <div className="text-center mb-4">
          <p className={`peak-text text-xl ${isAiThinking ? 'text-red-500 animate-pulse' : ''}`}>
            {isAiThinking ? 'La IA esta pensando...' : 
              gameState.currentPlayer === 'black' ? `${username} (Negras)` : 'IA (Rojas)'}
          </p>
        </div>

        <div className="flex justify-center mb-4">
          <GameBoard
            board={gameState.board}
            selectedPiece={selectedPiece}
            validMoves={validMoves}
            currentPlayer={gameState.currentPlayer}
            onCellClick={handleCellClick}
          />
        </div>

        <div className="flex justify-between peak-paper peak-border p-4">
          <div className="text-center">
<p className="peak-text text-sm text-gray-600">Capturadas por {username}</p>
            <p className="peak-text text-2xl">{gameState.capturedPieces.red}</p>
          </div>
          <div className="text-center">
            <p className="peak-text text-sm text-gray-600">Fichas restantes</p>
            <div className="flex gap-4">
              <span className="peak-text">N: {gameState.board.flat().filter((c: any) => c?.player === 'black').length}</span>
              <span className="peak-text">R: {gameState.board.flat().filter((c: any) => c?.player === 'red').length}</span>
            </div>
          </div>
          <div className="text-center">
            <p className="peak-text text-sm text-gray-600">Capturadas por IA</p>
            <p className="peak-text text-2xl">{gameState.capturedPieces.black}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
