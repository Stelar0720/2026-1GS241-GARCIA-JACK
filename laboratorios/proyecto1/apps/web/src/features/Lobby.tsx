// Sinnoh Edition - Lobby Screen
import { useState } from 'preact/hooks';
import type { Player, Room } from '../../App';
import { createRoom, joinRoom } from '../lib/api';

interface LobbyProps {
  player: Player;
  room: Room | null;
  onCreateRoom: (room: Room) => void;
  onJoinRoom: (room: Room) => void;
  onStartBan: () => void;
  bannedPokemon: string[];
  onBannedChange: (banned: string[]) => void;
}

export function Lobby({ player, room, onCreateRoom, onJoinRoom, onStartBan, bannedPokemon, onBannedChange }: LobbyProps) {
  const [mode, setMode] = useState<'select' | 'create' | 'join'>('select');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCreateRoom = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await createRoom(player.id);
      if (result.success) {
        onCreateRoom({
          id: result.roomId,
          code: result.code,
          opponent: null,
          status: 'waiting',
        });
      }
    } catch (e) {
      setError('Error al crear sala');
    }
    setLoading(false);
  };

  const handleJoinRoom = async () => {
    if (joinCode.length !== 6) {
      setError('Código inválido');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await joinRoom(joinCode.toUpperCase(), player.id);
      if (result.success) {
        onJoinRoom({
          id: result.roomId,
          code: joinCode.toUpperCase(),
          opponent: result.players?.[1] || 'Oponente',
          status: result.status,
        });
      }
    } catch (e) {
      setError('No se pudo unir a la sala');
    }
    setLoading(false);
  };

  return (
    <div class="screen lobby">
      <div class="ds-panel">
        <h2 style={{ fontSize: '14px', textAlign: 'center', marginBottom: '20px', color: '#e0c030' }}>
          LOBBY
        </h2>

        {!room && mode === 'select' && (
          <div class="ds-textbox">
            <p style={{ textAlign: 'center', marginBottom: '20px' }}>
              ¿Qué deseas hacer?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button class="ds-button gold" onClick={handleCreateRoom}>
                CREAR SALA
              </button>
              <button class="ds-button" onClick={() => setMode('join')}>
                UNIRSE A SALA
              </button>
            </div>
          </div>
        )}

        {!room && mode === 'join' && (
          <div class="ds-textbox">
            <p style={{ marginBottom: '12px' }}>Ingresa el código de sala:</p>
            <input
              type="text"
              class="ds-input"
              placeholder="ABCDEF"
              value={joinCode}
              onInput={(e) => setJoinCode((e.target as HTMLInputElement).value.toUpperCase())}
              maxLength={6}
              style={{ 
                textAlign: 'center', 
                fontSize: '18px', 
                letterSpacing: '8px',
                marginBottom: '16px'
              }}
            />
            {error && <p style={{ color: '#c03030', marginBottom: '12px' }}>{error}</p>}
            <div class="nav-buttons">
              <button class="ds-button" onClick={() => { setMode('select'); setError(null); }}>
                ATRÁS
              </button>
              <button 
                class="ds-button gold" 
                onClick={handleJoinRoom}
                disabled={joinCode.length !== 6}
              >
                UNIRSE
              </button>
            </div>
          </div>
        )}

        {room && (
          <div class="ds-textbox">
            <p style={{ textAlign: 'center', marginBottom: '12px' }}>Código de sala:</p>
            <div class="lobby-code">{room.code}</div>
            
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '20px' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '9px', marginBottom: '8px', color: '#a8a8c8' }}>TÚ</p>
                <div style={{ 
                  background: '#2a2a4a', 
                  padding: '12px',
                  borderRadius: '4px'
                }}>
                  <img 
                    src={player.spriteUrl} 
                    alt={player.name}
                    style={{ width: '48px', height: '48px', imageRendering: 'pixelated' }}
                  />
                  <p style={{ fontSize: '9px', marginTop: '4px' }}>{player.name}</p>
                </div>
              </div>
              
              <div style={{ 
                alignSelf: 'center', 
                fontSize: '24px',
                color: '#a8a8c8'
              }}>VS</div>
              
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '9px', marginBottom: '8px', color: '#a8a8c8' }}>ESPERANDO...</p>
                <div style={{ 
                  background: '#2a2a4a', 
                  padding: '12px',
                  borderRadius: '4px',
                  minWidth: '80px',
                  minHeight: '80px'
                }}>
                  <div class="loading" style={{ fontSize: '24px' }}>?</div>
                </div>
              </div>
            </div>

            <div class="nav-buttons">
              {room.status === 'waiting' ? (
                <div class="loading" style={{ padding: '12px' }}>
                  Esperando oponente...
                </div>
              ) : (
                <button class="ds-button gold" onClick={onStartBan}>
                  INICIAR BATALLA
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
