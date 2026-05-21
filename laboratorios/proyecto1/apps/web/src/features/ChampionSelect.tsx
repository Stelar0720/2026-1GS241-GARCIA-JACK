import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Player } from '../App';
import { generatePlayerId, saveLocalStorage } from '../lib/api';

interface ChampionSelectProps {
  player: Player | null;
  suggestedName?: string;
  onComplete: (player: Player) => void;
}

type Gender = 'male' | 'female' | 'other';

interface TrainerSprite {
  id: string;
  name: string;
  genderGroup: 'hombre' | 'mujer';
  url: string;
}

const spriteModules = import.meta.glob('../../../../sprites/**/*.{gif,png,GIF,PNG}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const TRAINER_SPRITES: TrainerSprite[] = Object.entries(spriteModules)
  .map(([path, url]) => {
    const normalizedPath = path.replace(/\\/g, '/');
    const genderGroup = normalizedPath.includes('/hombre/') ? 'hombre' : normalizedPath.includes('/mujer/') ? 'mujer' : null;
    if (!genderGroup) return null;

    const fileName = normalizedPath.split('/').pop() || 'sprite';
    const name = decodeURIComponent(fileName.replace(/\.(gif|png)$/i, '').replace(/_/g, ' '));

    return {
      id: normalizedPath,
      name,
      genderGroup,
      url,
    };
  })
  .filter(Boolean) as TrainerSprite[];

export function ChampionSelect({ player, suggestedName = '', onComplete }: ChampionSelectProps) {
  const [name, setName] = useState(player?.name || suggestedName.slice(0, 12));
  const [gender, setGender] = useState<Gender>(player?.gender || 'male');
  const [selectedSpriteUrl, setSelectedSpriteUrl] = useState(player?.spriteUrl || '');
  const [step, setStep] = useState<'name' | 'gender' | 'sprite' | 'confirm'>('name');

  const availableSprites = useMemo(() => {
    if (gender === 'male') return TRAINER_SPRITES.filter(sprite => sprite.genderGroup === 'hombre');
    if (gender === 'female') return TRAINER_SPRITES.filter(sprite => sprite.genderGroup === 'mujer');
    return TRAINER_SPRITES;
  }, [gender]);

  const selectedSprite = availableSprites.find(sprite => sprite.url === selectedSpriteUrl) || availableSprites[0] || null;

  useEffect(() => {
    if (!player?.name && suggestedName && !name.trim()) {
      setName(suggestedName.slice(0, 12));
    }
  }, [player?.name, suggestedName, name]);

  const handleNameSubmit = () => {
    if (name.trim().length >= 2) {
      setStep('gender');
    }
  };

  const handleGenderSelect = (nextGender: Gender) => {
    setGender(nextGender);
    setSelectedSpriteUrl('');
    setStep('sprite');
  };

  const handleSpriteSelect = (spriteUrl: string) => {
    setSelectedSpriteUrl(spriteUrl);
    setStep('confirm');
  };

  const handleConfirm = () => {
    if (!selectedSprite) return;

    const newPlayer: Player = {
      id: player?.id || generatePlayerId(),
      name: name.trim(),
      gender,
      spriteUrl: selectedSprite.url,
    };
    saveLocalStorage('player', newPlayer);
    onComplete(newPlayer);
  };

  return (
    <div class="screen champion-select">
      <div class="ds-panel">
        <h2 style={{ fontSize: '14px', textAlign: 'center', marginBottom: '20px', color: '#e0c030' }}>
          SELECCIONA A TU CAMPEON
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
              <button class="ds-button gold" onClick={handleNameSubmit} disabled={name.trim().length < 2}>
                CONTINUAR
              </button>
            </div>
          </div>
        )}

        {step === 'gender' && (
          <div class="ds-textbox">
            <p style={{ marginBottom: '16px' }}>Selecciona tu genero:</p>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '20px', flexWrap: 'wrap' }}>
              <button class={`ds-button ${gender === 'male' ? 'gold' : ''}`} onClick={() => handleGenderSelect('male')}>
                HOMBRE
              </button>
              <button class={`ds-button ${gender === 'female' ? 'gold' : ''}`} onClick={() => handleGenderSelect('female')}>
                MUJER
              </button>
              <button class={`ds-button ${gender === 'other' ? 'gold' : ''}`} onClick={() => handleGenderSelect('other')}>
                OTRO
              </button>
            </div>
          </div>
        )}

        {step === 'sprite' && (
          <div class="ds-textbox">
            <p style={{ marginBottom: '16px', textAlign: 'center' }}>Elige tu personaje:</p>
            {availableSprites.length === 0 ? (
              <p style={{ fontSize: '9px', color: '#c03030', textAlign: 'center' }}>
                No hay sprites disponibles para esta opcion.
              </p>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))',
                gap: '10px',
                maxHeight: '320px',
                overflow: 'auto',
              }}>
                {availableSprites.map(sprite => (
                  <button
                    key={sprite.id}
                    class={`ds-button ${selectedSpriteUrl === sprite.url ? 'gold' : ''}`}
                    onClick={() => handleSpriteSelect(sprite.url)}
                    style={{ padding: '8px', minWidth: 'auto' }}
                  >
                    <img
                      src={sprite.url}
                      alt={sprite.name}
                      style={{
                        width: '72px',
                        height: '72px',
                        objectFit: 'contain',
                        imageRendering: sprite.url.toLowerCase().endsWith('.gif') ? 'auto' : 'pixelated',
                        display: 'block',
                        margin: '0 auto 6px',
                      }}
                    />
                    <span style={{ display: 'block', fontSize: '7px', color: '#a8a8c8', overflowWrap: 'anywhere' }}>
                      {sprite.name.substring(0, 18)}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <div class="nav-buttons" style={{ marginTop: '16px' }}>
              <button class="ds-button" onClick={() => setStep('gender')}>
                ATRAS
              </button>
            </div>
          </div>
        )}

        {step === 'confirm' && selectedSprite && (
          <div class="ds-textbox">
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{
                width: '112px',
                height: '112px',
                margin: '0 auto 16px',
                background: '#1a1a2e',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #e0c030',
              }}>
                <img
                  src={selectedSprite.url}
                  alt={selectedSprite.name}
                  style={{ width: '96px', height: '96px', objectFit: 'contain' }}
                />
              </div>
              <p style={{ fontSize: '14px', color: '#e0c030' }}>{name}</p>
              <p style={{ fontSize: '10px', color: '#a8a8c8', marginTop: '4px' }}>
                {gender === 'male' ? 'Hombre' : gender === 'female' ? 'Mujer' : 'Otro'} - {selectedSprite.name}
              </p>
            </div>
            <div class="nav-buttons">
              <button class="ds-button" onClick={() => setStep('sprite')}>
                ATRAS
              </button>
              <button class="ds-button gold" onClick={handleConfirm}>
                CONFIRMAR
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
