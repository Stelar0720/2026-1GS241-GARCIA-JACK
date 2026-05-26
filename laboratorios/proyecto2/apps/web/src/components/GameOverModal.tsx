import React from 'react';

interface GameOverModalProps {
  winner: 'red' | 'black' | null;
  moveCount: number;
  username: string;
  onPlayAgain: () => void;
  onGoHome: () => void;
}

export function GameOverModal({ 
  winner, 
  moveCount, 
  username, 
  onPlayAgain, 
  onGoHome 
}: GameOverModalProps) {
  const isWin = winner === 'black';
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="peak-paper peak-border p-8 max-w-md w-full peak-enter">
        <div className="text-center">
          {isWin ? (
            <>
              <p className="text-6xl mb-4">🏆</p>
              <h2 className="peak-title text-3xl text-amber-600 mb-2">
                ¡VICTORIA!
              </h2>
              <p className="peak-text text-xl">
                {username} completó la partida
              </p>
            </>
          ) : (
            <>
              <p className="text-6xl mb-4">😔</p>
              <h2 className="peak-title text-3xl text-gray-600 mb-2">
                DERROTA
              </h2>
              <p className="peak-text text-xl">
                La IA ha ganado esta vez
              </p>
            </>
          )}
        </div>

        <div className="my-6 p-4 bg-amber-50 rounded-lg border border-amber-200 text-center">
          <p className="peak-text text-lg">
            {isWin ? '¡Felicidades!' : '¡Sigue intentando!'}
          </p>
          <p className="peak-text text-2xl mt-2">
            <span className="text-4xl font-bold">{moveCount}</span>
            <span className="text-lg ml-2">movimientos</span>
          </p>
          {isWin && (
            <p className="text-sm text-gray-600 mt-2">
              ¡menos movimientos = mejor ranking!
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={onPlayAgain}
            className="peak-button w-full text-lg"
          >
            🔄 Jugar de Nuevo
          </button>
          <button
            onClick={onGoHome}
            className="peak-button w-full bg-gray-200 hover:bg-gray-300"
          >
            🏠 Volver al Inicio
          </button>
        </div>
      </div>
    </div>
  );
}
