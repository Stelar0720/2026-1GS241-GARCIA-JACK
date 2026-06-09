import React from 'react';
import type { Piece as PieceType } from '~/lib/api-client';
import { getEquippedSkin } from '~/lib/skin-storage';
import { getSkinById, type SkinAssets } from '~/lib/skins';

interface PieceProps {
  piece: PieceType;
  isSelected: boolean;
  onClick: () => void;
  skinAssets?: SkinAssets;
}

export function Piece({ piece, isSelected, onClick, skinAssets }: PieceProps) {
  const userId = typeof window !== 'undefined' ? window.localStorage.getItem('clerkId') : null;
  const assets = skinAssets || getSkinById(getEquippedSkin(userId)).assets;
  const imageSrc = piece.player === 'black'
    ? (piece.isKing ? assets.blackQueen : assets.blackPiece)
    : (piece.isKing ? assets.whiteQueen : assets.whitePiece);

  const baseClasses = `
    w-[80%] h-[80%] rounded-full
    flex items-center justify-center
    transition-all duration-200
    cursor-pointer
    shadow-lg
    ${isSelected ? 'ring-4 ring-yellow-400 ring-offset-2' : ''}
  `;

  return (
    <div onClick={onClick} className={baseClasses}>
      <img
        src={imageSrc}
        alt={piece.isKing ? 'Reina de damas' : 'Pieza de damas'}
        className="w-full h-full object-contain drop-shadow-lg select-none pointer-events-none"
        draggable={false}
      />
    </div>
  );
}
