import React from 'react';
import type { Board, Position, Piece as PieceType, Move } from '~/lib/api-client';
import { getEquippedSkin } from '~/lib/skin-storage';
import { getSkinById } from '~/lib/skins';
import { Piece } from './Piece';

interface BoardProps {
  board: Board;
  selectedPiece: Position | null;
  validMoves: Move[];
  currentPlayer: 'red' | 'black';
  onCellClick: (row: number, col: number) => void;
}

const CELL_SIZE = 70; // pixels

export function GameBoard({ board, selectedPiece, validMoves, currentPlayer, onCellClick }: BoardProps) {
  const userId = typeof window !== 'undefined' ? window.localStorage.getItem('clerkId') : null;
  const skinAssets = getSkinById(getEquippedSkin(userId)).assets;

  const isSelected = (row: number, col: number) => {
    return selectedPiece?.row === row && selectedPiece?.col === col;
  };

  const isValidMove = (row: number, col: number) => {
    return validMoves.some(m => m.to.row === row && m.to.col === col);
  };

  const canInteract = (row: number, col: number) => {
    const piece = board[row][col];
    
    // Solo permitir interactuar si es una ficha del jugador actual
    if (piece && piece.player === currentPlayer) return true;
    
    // Permitir hacer clic en celdas de movimiento válido
    if (isValidMove(row, col)) return true;
    
    return false;
  };

  return (
    <div
      className="game-board"
      style={{
        gridTemplateColumns: `repeat(${board.length}, 1fr)`,
        gridTemplateRows: `repeat(${board.length}, 1fr)`,
      }}
    >
      {board.map((row, rowIndex) =>
        row.map((cell, colIndex) => {
          const isDark = (rowIndex + colIndex) % 2 === 1;
          const piece = board[rowIndex][colIndex];
          const selected = isSelected(rowIndex, colIndex);
          const valid = isValidMove(rowIndex, colIndex);

          return (
            <div
              key={`${rowIndex}-${colIndex}`}
              onClick={() => canInteract(rowIndex, colIndex) && onCellClick(rowIndex, colIndex)}
              className={`
                cell
                ${isDark ? 'cell-dark' : 'cell-light'}
                ${selected ? 'selected' : ''}
                ${valid ? 'valid-move' : ''}
              `}
            >
              {piece && (
                <Piece
                  piece={piece}
                  isSelected={selected}
                  onClick={() => onCellClick(rowIndex, colIndex)}
                  skinAssets={skinAssets}
                />
              )}
              {valid && !piece && (
                <div className="w-6 h-6 rounded-full bg-yellow-400/40 border-2 border-yellow-400 animate-pulse" />
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
