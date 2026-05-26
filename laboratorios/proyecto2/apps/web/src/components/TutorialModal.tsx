import React from 'react';
import { Link } from '@tanstack/react-start';

interface TutorialModalProps {
  onClose: () => void;
  onSkip: () => void;
}

export function TutorialModal({ onClose, onSkip }: TutorialModalProps) {
  const rules = [
    {
      title: '📍 Movimiento',
      content: 'Las fichas se mueven en diagonal hacia adelante, una casilla a la vez.'
    },
    {
      title: '🎯 Captura',
      content: 'Para capturar una ficha enemiga, salta sobre ella en diagonal. La captura es obligatoria si está disponible.'
    },
    {
      title: '♔ Coronación',
      content: 'Cuando una ficha alcanza el extremo opuesto del tablero, se convierte en Rey. ¡Los Reyes pueden moverse en cualquier dirección!'
    },
    {
      title: '🏆 Victoria',
      content: 'Gana quien capture todas las fichas enemigas o bloquee todos sus movimientos.'
    },
    {
      title: '📊 Puntuación',
      content: 'Tu ranking se basará en la cantidad de movimientos que uses. ¡Menos movimientos = mejor puntuación!'
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="peak-paper peak-border p-8 max-w-2xl w-full peak-enter">
        <div className="text-center mb-6">
          <span className="peak-title text-2xl block mb-2">📜 PEAK INSTRUCTIONS 📜</span>
          <p className="text-gray-600 peak-text">Antiquus Checkers Manual</p>
        </div>

        <div className="space-y-4 mb-8">
          {rules.map((rule, index) => (
            <div 
              key={index} 
              className="flex items-start gap-4 p-4 bg-amber-50/50 rounded-lg border border-amber-200"
            >
              <div className="peak-title text-amber-700">{index + 1}.</div>
              <div>
                <h3 className="peak-text text-lg font-bold text-gray-800">{rule.title}</h3>
                <p className="text-gray-600 mt-1">{rule.content}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              id="dont-show-again"
              className="w-5 h-5 rounded border-2 border-gray-400"
            />
            <span className="peak-text">No mostrar de nuevo</span>
          </label>

          <div className="flex gap-4">
            <button
              onClick={onSkip}
              className="peak-button bg-gray-200 hover:bg-gray-300"
            >
              Saltar
            </button>
            <button
              onClick={onClose}
              className="peak-button"
            >
              Entendido ✓
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
