import React from 'react';
import type { Piece as PieceType } from '~/lib/api-client';

interface PieceProps {
  piece: PieceType;
  isSelected: boolean;
  onClick: () => void;
}

export function Piece({ piece, isSelected, onClick }: PieceProps) {
  const baseClasses = `
    w-[80%] h-[80%] rounded-full 
    flex items-center justify-center
    transition-all duration-200
    cursor-pointer
    shadow-lg
    ${isSelected ? 'ring-4 ring-yellow-400 ring-offset-2' : ''}
  `;

  const colorClasses = piece.player === 'red'
    ? 'bg-gradient-to-br from-red-400 to-red-700 border-red-800'
    : 'bg-gradient-to-br from-gray-300 to-gray-600 border-gray-800';

  return (
    <div
      onClick={onClick}
      className={baseClasses}
    >
      <div className={`
        w-full h-full rounded-full
        ${piece.player === 'red' 
          ? 'bg-gradient-to-br from-red-500 to-red-800' 
          : 'bg-gradient-to-br from-gray-400 to-gray-700'
        }
        border-4 ${piece.player === 'red' ? 'border-red-900' : 'border-gray-900'}
        shadow-inner
        relative
      `}>
        {/* Efecto de brillo */}
        <div className={`
          absolute inset-2 rounded-full
          ${piece.player === 'red'
            ? 'bg-gradient-to-br from-red-300/30 to-transparent'
            : 'bg-gradient-to-br from-white/20 to-transparent'
          }
        `} />
        
        {/* Corona para reyes */}
        {piece.isKing && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl">♔</span>
          </div>
        )}
      </div>
    </div>
  );
}
