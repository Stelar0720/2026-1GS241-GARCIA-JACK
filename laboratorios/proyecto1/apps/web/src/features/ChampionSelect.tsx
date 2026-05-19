// Sinnoh Edition - Champion Select Screen with Region Selection
import { useState } from 'preact/hooks';
import type { Player } from '../App';
import { generatePlayerId, getTrainerSprite, saveLocalStorage, REGIONS } from '../lib/api';

interface ChampionSelectProps {
  player: Player | null;
  onComplete: (player: Player) => void;
}

export function ChampionSelect({ player, onComplete }: ChampionSelectProps) {
  const [name, setName] = useState(player?.name || '');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>(player?.gender || 'male');
  const [region, setRegion] = useState('sinnoh');
  const [step, setStep] = useState<'name' | 'region' | 'gender' | 'confirm'>('name');

  const handleNameSubmit = () => {
    if (name.trim().length >= 2) {
      setStep('region');
    }
  };

  const handleRegionSelect = (r: string) => {
    setRegion(r);
    setStep('gender');
  };

  const handleGenderSelect = (g: 'male' | 'female' | 'other') => {
    setGender(g);
    setStep('confirm');
  };

  const handleConfirm = () => {
    const spriteUrl = getTrainerSprite(gender, region);
    const newPlayer: Player = {
      id: player?.id || generatePlayerId(),
      name: name.trim(),
      gender,
      spriteUrl,
    };
    saveLocalStorage('player', newPlayer);
    onComplete(newPlayer);
  };

  const trainerSprite = getTrainerSprite(gender, region);

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

        {step === 'region' && (
          <div class="ds-textbox">
            <p style={{ marginBottom: '16px', textAlign: 'center' }}>Selecciona tu región favorita:</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginTop: '16px' }}>
              {REGIONS.map((r) => (
                <button
                  key={r.id}
                  class={`ds-button ${region === r.id ? 'gold' : ''}`}
                  onClick={() => handleRegionSelect(r.id)}
                  style={{
                    borderLeft: `4px solid ${r.color}`,
                  }}
                >
                  {r.name}
                </button>
              ))}
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
              {/* Trainer sprite with fallback */}
              <div style={{
                width: '96px',
                height: '96px',
                margin: '0 auto 16px',
                background: REGIONS.find(r => r.id === region)?.color || '#b8c8d8',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #e0c030',
              }}>
                <img 
                  src={trainerSprite}
                  alt="Trainer"
                  style={{ 
                    width: '96px', 
                    height: '96px',
                    imageRendering: 'auto',
                  }}
                />
              </div>
              <p style={{ fontSize: '14px', color: '#e0c030' }}>{name}</p>
              <p style={{ fontSize: '10px', color: '#a8a8c8', marginTop: '4px' }}>
                {gender === 'male' ? 'Hombre' : gender === 'female' ? 'Mujer' : 'Otro'} - {REGIONS.find(r => r.id === region)?.name || 'Sinnoh'}
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