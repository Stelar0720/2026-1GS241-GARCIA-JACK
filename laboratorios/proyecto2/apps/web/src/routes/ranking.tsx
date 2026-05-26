import { Link, createRootRoute } from '@tanstack/react-start';
import { RankingTable } from '~/components/RankingTable';
import { useState, useEffect } from 'react';
import type { RankingEntry } from '~/lib/api-client';
import { API_URL } from '~/lib/api-client';

export const Route = createRootRoute({
  component: RankingPage,
});

function RankingPage() {
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const username = localStorage.getItem('username') || undefined;

  useEffect(() => {
    const fetchRankings = async () => {
      try {
        const response = await fetch(`${API_URL}/ranking/top?limit=20`);
        if (!response.ok) throw new Error('Error al cargar rankings');
        const data = await response.json();
        setRankings(data.rankings || []);
      } catch (err) {
        console.error('Error:', err);
        // Usar datos de ejemplo si la API no está disponible
        setRankings([
          {
            id: 1,
            username: 'Erick',
            moves: 50,
            difficulty: 'hard',
            gameMode: 'pva',
            createdAt: new Date()
          },
          {
            id: 2,
            username: 'Bethel',
            moves: 30,
            difficulty: 'hard',
            gameMode: 'pva',
            createdAt: new Date()
          },
          {
            id: 3,
            username: 'Juan',
            moves: 45,
            difficulty: 'medium',
            gameMode: 'pva',
            createdAt: new Date()
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchRankings();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-100 to-amber-200 p-4">
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="inline-block mb-6">
          <button className="peak-button">
            ← Volver al Inicio
          </button>
        </Link>

        <RankingTable
          rankings={rankings}
          currentUsername={username}
        />

        {/* Info */}
        <div className="mt-6 peak-paper peak-border p-4 text-center">
          <p className="peak-text text-sm text-gray-600">
            💡 El ranking se ordena por cantidad de movimientos.<br />
            ¡Menos movimientos = mejor posición!
          </p>
        </div>
      </div>
    </div>
  );
}
