import React from 'react';
import type { RankingEntry } from '~/lib/api-client';

interface RankingTableProps {
  rankings: RankingEntry[];
  currentUsername?: string;
  title?: string;
}

export function RankingTable({ rankings, currentUsername, title = 'TABLA DE RANKING' }: RankingTableProps) {
  const getDifficultyBadge = (difficulty: string) => {
    const badges = {
      easy: { label: 'Facil', class: 'bg-green-100 text-green-800' },
      medium: { label: 'Medio', class: 'bg-yellow-100 text-yellow-800' },
      hard: { label: 'Dificil', class: 'bg-red-100 text-red-800' }
    };
    const badge = badges[difficulty as keyof typeof badges] || badges.medium;
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${badge.class}`}>
        {badge.label}
      </span>
    );
  };

  const getModeLabel = (entry: RankingEntry) => {
    const variants: Record<string, string> = {
      international: 'Internacionales',
      spanish: 'Espanolas',
      english: 'Inglesas',
      turkish: 'Turcas',
      russian: 'Rusas'
    };
    const gameMode = entry.gameMode === 'pva' ? 'vs IA' : entry.gameMode;
    return `${gameMode} - ${variants[entry.checkersVariant || 'english'] || entry.checkersVariant || 'Inglesas'}`;
  };

  return (
    <div className="peak-paper peak-border p-6">
      <h2 className="peak-title text-xl mb-6 text-center">{title}</h2>

      {rankings.length === 0 ? (
        <div className="text-center py-8 text-gray-500 peak-text">
          <p>No hay partidas guardadas todavia.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-amber-300">
                <th className="peak-text py-3 px-2 text-left">#</th>
                <th className="peak-text py-3 px-2 text-left">Jugador</th>
                <th className="peak-text py-3 px-2 text-left">Mov.</th>
                <th className="peak-text py-3 px-2 text-left">Dificultad</th>
                <th className="peak-text py-3 px-2 text-left">Modo de juego</th>
                <th className="peak-text py-3 px-2 text-left">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((entry, index) => (
                <tr
                  key={entry.id}
                  className={`
                    border-b border-amber-100
                    ${currentUsername === entry.username ? 'bg-amber-50' : 'hover:bg-amber-50/50'}
                    ${index < 3 ? 'font-bold' : ''}
                  `}
                >
                  <td className="py-3 px-2 text-lg">#{index + 1}</td>
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2">
                      <span className="peak-text">{entry.username}</span>
                      {currentUsername === entry.username && (
                        <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded">
                          Tu
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    <span className="peak-text text-lg">{entry.moves}</span>
                  </td>
                  <td className="py-3 px-2">
                    {getDifficultyBadge(entry.difficulty)}
                  </td>
                  <td className="py-3 px-2 text-sm text-gray-700 peak-text">
                    {getModeLabel(entry)}
                  </td>
                  <td className="py-3 px-2 text-sm text-gray-500">
                    {new Date(entry.createdAt).toLocaleDateString('es-ES')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
