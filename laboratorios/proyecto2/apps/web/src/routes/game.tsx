import { Link, createRootRoute } from '@tanstack/react-start';
import { TutorialModal } from '~/components/TutorialModal';
import { DifficultySelect } from '~/components/DifficultySelect';
import { useState, useEffect } from 'react';
import type { Difficulty } from '~/lib/api-client';

export const Route = createRootRoute({
  component: NewGame,
});

function NewGame() {
  const [showTutorial, setShowTutorial] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [username, setUsername] = useState('');
  const [isGuest, setIsGuest] = useState(true);
  const [gameStarted, setGameStarted] = useState(false);

  // Cargar Clerk si esta presente
  useEffect(() => {
    const savedUsername = localStorage.getItem('username');
    const savedClerkId = localStorage.getItem('clerkId');
    if (savedUsername) {
      setUsername(savedUsername);
      setIsGuest(false);
    }
  }, []);

  useEffect(() => {
    if (!localStorage.getItem('skipTutorial')) {
      setShowTutorial(true);
    }
  }, []);

  const handleTutorialClose = () => {
    setShowTutorial(false);
    localStorage.setItem('skipTutorial', 'true');
  };

  const handleTutorialSkip = () => {
    setShowTutorial(false);
    localStorage.setItem('skipTutorial', 'true');
  };

  const handleStartGame = () => {
    if (!username.trim() && isGuest) {
      alert('Por favor ingresa tu nombre');
      return;
    }
    
    const finalUsername = username.trim() || `Jugador${Math.floor(Math.random() * 9999)}`;
    localStorage.setItem('username', finalUsername);
    
    const clerkId = localStorage.getItem('clerkId');
    const queryParams = new URLSearchParams({
      difficulty,
      username: finalUsername,
      guest: isGuest ? 'true' : 'false'
    });
    
    if (clerkId) {
      queryParams.set('clerkId', clerkId);
    }
    
    window.location.href = `/play?${queryParams.toString()}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-100 to-amber-200 p-4">
      {showTutorial && (
        <TutorialModal onClose={handleTutorialClose} onSkip={handleTutorialSkip} />
      )}

      <div className="max-w-lg mx-auto">
        <Link to="/" className="inline-block mb-6">
          <button className="peak-button">Volver</button>
        </Link>

        <div className="peak-paper peak-border p-6 mb-6">
          <h1 className="peak-title text-2xl text-center mb-6">Nueva Partida</h1>

          {/* Username */}
          <div className="mb-6">
            <label className="peak-text block mb-2">Tu Nombre:</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ingresa tu nombre"
              className="peak-input w-full"
              maxLength={20}
            />
          </div>

          {/* Mode Selection */}
          <div className="mb-6">
            <label className="peak-text block mb-3">Modo de Juego:</label>
            <div className="flex gap-4">
              <button className="flex-1 p-3 rounded-lg border-2 border-amber-400 bg-amber-50 peak-text">
                vs IA
              </button>
            </div>
          </div>

          {/* Difficulty Selection */}
          <DifficultySelect value={difficulty} onChange={setDifficulty} />
        </div>

        <button
          onClick={handleStartGame}
          disabled={!username.trim() && !localStorage.getItem('username')}
          className="peak-button w-full text-xl py-4 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Iniciar Partida
        </button>
      </div>
    </div>
  );
}
