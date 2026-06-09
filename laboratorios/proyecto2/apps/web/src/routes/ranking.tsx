import { Link, createRootRoute } from '@tanstack/react-start';
import { RankingTable } from '~/components/RankingTable';
import { useState, useEffect } from 'react';
import type { RankingEntry } from '~/lib/api-client';
import { API_URL } from '~/lib/api-client';

export const Route = createRootRoute({
  component: RankingPage,
});

function RankingPage() {
  const [victories, setVictories] = useState<RankingEntry[]>([]);
  const [defeats, setDefeats] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const username = localStorage.getItem('username') || undefined;

  useEffect(() => {
    const fetchRankings = async () => {
      try {
        const response = await fetch(`${API_URL}/ranking/top?limit=5`);
        if (!response.ok) throw new Error('Error al cargar rankings');
        const data = await response.json();
        setVictories(data.victories || []);
        setDefeats(data.defeats || []);
      } catch (err) {
        console.error('Error:', err);
        setVictories([]);
        setDefeats([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRankings();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-100 to-amber-200 p-4">
      <div className="max-w-5xl mx-auto">
        <Link to="/" className="inline-block mb-6">
          <button className="peak-button">Volver al Inicio</button>
        </Link>

        {loading ? (
          <div className="peak-paper peak-border p-6 text-center">
            <p className="peak-text">Cargando ranking...</p>
          </div>
        ) : (
          <div className="space-y-6">
            <RankingTable rankings={victories} currentUsername={username} title="RANKING GLOBAL - VICTORIAS" />
            <RankingTable rankings={defeats} currentUsername={username} title="RANKING GLOBAL - DERROTAS" />
          </div>
        )}
      </div>
    </div>
  );
}
