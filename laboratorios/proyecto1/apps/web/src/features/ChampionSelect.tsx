// Sinnoh Edition - Champion Select Screen
import { useState } from 'preact/hooks';
import type { Player } from '../../App';
import { generatePlayerId, getTrainerSprite, saveLocalStorage } from '../lib/api';

interface ChampionSelectProps {
  player: Player | null;
  onComplete: (player: Player) => void;
}

export function ChampionSelect({ player, onComplete }: ChampionSelectProps) {
  const [name, setName] = useState(player?.name || '');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>(player?.gender || 'male');
  const [step, setStep] = useState<'name' | 'gender' | 'confirm'>('name');

  const handleNameSubmit = () => {
    if (name.trim().length >= 2) {
      setStep('gender');
    }
  };

  const handleGenderSelect = (g: 'male' | 'female' | 'other') => {
    setGender(g);
    setStep('confirm');
  };

  const handleConfirm = () => {
    const newPlayer: Player = {
      id: player?.id || generatePlayerId(),
      name: name.trim(),
      gender,
      spriteUrl: getTrainerSprite(gender),
    };
    saveLocalStorage('player', newPlayer);
    onComplete(newPlayer);
  };

  return (
    <div class="screen champion-select">
      <div class="ds-panel">
        <h2 style={{ fontSize: '14px', textAlign: 'center', marginBottom: '20px', color: '#e0c030' }}>
          SELECCIONA A TU CAMPEÓN
        </h2>

        {step === 'name' && (
          <div class="ds-textbox">
            <p style={{ marginBottom: '16px' }}>Ingresa tu nombre de entrenador:</p>
            <input
              type="text"
              class="ds-input"
              placeholder="Tu nombre..."
              value={name}
              onInput={(e) => setName((e.target as HTMLInputElement).value)}
              maxLength={12}
              style={{ marginBottom: '16px' }}
            />
            <div class="nav-buttons">
              <button 
                class="ds-button gold"
                onClick={handleNameSubmit}
                disabled={name.trim().length < 2}
              >
                CONTINUAR
              </button>
            </div>
          </div>
        )}

        {step === 'gender' && (
          <div class="ds-textbox">
            <p style={{ marginBottom: '16px' }}>Selecciona tu género:</p>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '20px' }}>
              <button 
                class={`ds-button ${gender === 'male' ? 'gold' : ''}`}
                onClick={() => handleGenderSelect('male')}
              >
                HOMBRE
              </button>
              <button 
                class={`ds-button ${gender === 'female' ? 'gold' : ''}`}
                onClick={() => handleGenderSelect('female')}
              >
                MUJER
              </button>
              <button 
                class={`ds-button ${gender === 'other' ? 'gold' : ''}`}
                onClick={() => handleGenderSelect('other')}
              >
                OTRO
              </button>
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <div class="ds-textbox">
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <img 
                src={getTrainerSprite(gender)} 
                alt="Trainer" 
                style={{ 
                  width: '96px', 
                  height: '96px', 
                  imageRendering: 'pixelated',
                  marginBottom: '16px'
                }}
              />
              <p style={{ fontSize: '12px', color: '#e0c030' }}>{name}</p>
              <p style={{ fontSize: '9px', color: '#a8a8c8', marginTop: '4px' }}>
                {gender === 'male' ? 'Hombre' : gender === 'female' ? 'Mujer' : 'Otro'}
              </p>
            </div>
            <div class="nav-buttons">
              <button 
                class="ds-button"
                onClick={() => setStep('name')}
              >
                ATRÁS
              </button>
              <button 
                class="ds-button gold"
                onClick={handleConfirm}
              >
                CONFIRMAR
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
