// Sinnoh Edition - Lobby Screen with WebSocket
import { useState } from 'preact/hooks';
import type { Player, Room } from '../App';

interface LobbyProps {
  player: Player;
  room: Room | null;
  opponent: Player | null;
  isOpponentReady: boolean;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onReady: () => void;
  onStartBan: () => void;
  isConnected: boolean;
}

export function Lobby({ player, room, opponent, isOpponentReady, onCreateRoom, onJoinRoom, onReady, onStartBan, isConnected }: LobbyProps) {
  const [mode, setMode] = useState<'select' | 'create' | 'join'>('select');
  const [joinCode, setJoinCode] = useState('');
  const [isReady, setIsReady] = useState(false);

  const handleJoinRoom = () => {
    if (joinCode.length === 6) {
      onJoinRoom(joinCode.toUpperCase());
    }
  };

  const handleReady = () => {
    setIsReady(true);
    onReady();
  };

  return (
    <div class="screen lobby">
      <div class="ds-panel">
        <h2 style={{ fontSize: '14px', textAlign: 'center', marginBottom: '20px', color: '#e0c030' }}>
          LOBBY
        </h2>

        {!isConnected && (
          <div class="ds-textbox" style={{ background: '#3a2020', borderColor: '#c03030', marginBottom: '16px' }}>
            <p style={{ textAlign: 'center', color: '#c03030' }}>
              ⚠️ No conectado al servidor. Esperando...
            </p>
          </div>
        )}

        {!room && mode === 'select' && (
          <div class="ds-textbox">
            <p style={{ textAlign: 'center', marginBottom: '20px' }}>
              ¿Qué deseas hacer?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button 
                class="ds-button gold" 
                onClick={() => onCreateRoom()}
                disabled={!isConnected}
              >
                CREAR SALA
              </button>
              <button 
                class="ds-button" 
                onClick={() => setMode('join')}
                disabled={!isConnected}
              >
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
            <div class="nav-buttons">
              <button class="ds-button" onClick={() => setMode('select')}>
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
                  borderRadius: '4px',
                  border: isReady ? '2px solid #78c850' : '2px solid #4a4a8a'
                }}>
                  <img 
                    src={player.spriteUrl} 
                    alt={player.name}
                    style={{ width: '48px', height: '48px', imageRendering: 'pixelated' }}
                  />
                  <p style={{ fontSize: '9px', marginTop: '4px' }}>{player.name}</p>
                  {isReady && <p style={{ fontSize: '8px', color: '#78c850' }}>✓ LISTO</p>}
                </div>
              </div>
              
              <div style={{ 
                alignSelf: 'center', 
                fontSize: '24px',
                color: '#a8a8c8'
              }}>VS</div>
              
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '9px', marginBottom: '8px', color: '#a8a8c8' }}>
                  {opponent ? 'OPONENTE' : 'ESPERANDO...'}
                </p>
                <div style={{ 
                  background: '#2a2a4a', 
                  padding: '12px',
                  borderRadius: '4px',
                  minWidth: '80px',
                  minHeight: '80px',
                  border: isOpponentReady ? '2px solid #78c850' : '2px solid #4a4a8a'
                }}>
                  {opponent ? (
                    <>
                      <img 
                        src={opponent.spriteUrl || 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainer/ Lucas.png'} 
                        alt="Opponent"
                        style={{ width: '48px', height: '48px', imageRendering: 'pixelated' }}
                      />
                      <p style={{ fontSize: '9px', marginTop: '4px' }}>{opponent.name}</p>
                      {isOpponentReady && <p style={{ fontSize: '8px', color: '#78c850' }}>✓ LISTO</p>}
                    </>
                  ) : (
                    <div class="loading" style={{ fontSize: '24px', lineHeight: '80px' }}>?</div>
                  )}
                </div>
              </div>
            </div>

            <div class="nav-buttons">
              {!opponent ? (
                <div class="loading" style={{ padding: '12px' }}>
                  Esperando oponente...
                </div>
              ) : !isReady ? (
                <button class="ds-button gold" onClick={handleReady}>
                  ESTOY LISTO
                </button>
              ) : !isOpponentReady ? (
                <div style={{ padding: '12px', color: '#a8a8c8' }}>
                  Esperando que tu oponente esté listo...
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
