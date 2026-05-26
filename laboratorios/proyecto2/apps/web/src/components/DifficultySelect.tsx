import React from 'react';
import { Link } from '@tanstack/react-start';

interface DifficultySelectProps {
  value: string;
  onChange: (value: 'easy' | 'medium' | 'hard') => void;
}

const difficulties = [
  { 
    value: 'easy', 
    label: 'Fácil', 
    icon: '🌱',
    description: 'Perfecto para principiantes. La IA piensa 2 movimientos adelante.'
  },
  { 
    value: 'medium', 
    label: 'Medio', 
    icon: '⚔️',
    description: 'Un desafío equilibrado con inteligencia artificial mejorada.'
  },
  { 
    value: 'hard', 
    label: 'Difícil', 
    icon: '🔥',
    description: 'Modo experto. La IA analisa hasta 6 movimientos adelante.'
  }
];

export function DifficultySelect({ value, onChange }: DifficultySelectProps) {
  return (
    <div className="peak-paper peak-border p-6 peak-enter">
      <h2 className="peak-title text-xl mb-6 text-center">Selecciona la Dificultad</h2>
      
      <div className="flex flex-col gap-4">
        {difficulties.map((diff) => (
          <button
            key={diff.value}
            onClick={() => onChange(diff.value as 'easy' | 'medium' | 'hard')}
            className={`
              w-full p-4 rounded-lg text-left
              transition-all duration-200
              ${value === diff.value 
                ? 'bg-amber-100 border-2 border-amber-500 shadow-lg scale-[1.02]' 
                : 'bg-amber-50 border-2 border-amber-200 hover:border-amber-400'
              }
            `}
          >
            <div className="flex items-center gap-3">
              <span className="text-4xl">{diff.icon}</span>
              <div>
                <h3 className="peak-text text-lg font-bold">{diff.label}</h3>
                <p className="text-sm text-gray-600 mt-1">{diff.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
