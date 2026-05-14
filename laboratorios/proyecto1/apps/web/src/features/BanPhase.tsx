// Sinnoh Edition - Ban Phase Screen with WebSocket and Timer
import { useState, useEffect } from 'preact/hooks';
import type { Player, Room } from '../App';
import { fetchPokemon } from '../lib/api';

interface BanPhaseProps {
  player: Player;
  room: Room;
  bannedPokemon: string[];
  currentBanTurn: string | null;
  onBan: (pokemonId: string) => void;
  onBanComplete: () => void;
  timeRemaining: number;
  player1Bans: number;
  player2Bans: number;
}

export function BanPhase({ 
  player, 
  room: _room, 
  bannedPokemon, 
  currentBanTurn,
  onBan, 
  onBanComplete,
  timeRemaining,
  player1Bans,
  player2Bans
}: BanPhaseProps) {
  const [pokemons, setPokemons] = useState<any[]>([]);
  const [myBans, setMyBans] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(timeRemaining);
  const maxBans = 3;

  const isMyTurn = currentBanTurn === player.id;

  useEffect(() => {
    setTimeLeft(timeRemaining);
  }, [timeRemaining]);

  useEffect(() => {
    const loadPokemons = async () => {
      // Load Sinnoh pokemons for demo
      const gen4Ids = Array.from({ length: 50 }, (_, i) => i + 387);
      const loaded = await Promise.all(
        gen4Ids.map(async (id) => {
          try {
            const data = await fetchPokemon(id);
            return data;
          } catch {
            return null;
          }
        })
      );
      setPokemons(loaded.filter(Boolean));
      setLoading(false);
    };
    loadPokemons();
  }, []);

  const handleBan = (pokemonId: string) => {
    if (!isMyTurn) return;
    if (myBans.length >= maxBans) return;
    if (bannedPokemon.includes(pokemonId)) return;

    setMyBans([...myBans, pokemonId]);
    onBan(pokemonId);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // All bans complete (6 total)
  const allBansComplete = bannedPokemon.length >= 6;

  return (
    <div class="screen ban-phase">
      <div class="ds-panel">
        {/* Timer Display */}
        <div class="ban-timer-display" style={{
          background: timeLeft <= 10 ? '#c03030' : '#1a1a2e',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '16px',
          textAlign: 'center',
          border: `2px solid ${isMyTurn ? '#e0c030' : '#4a4a8a'}`
        }}>
          <div style={{ fontSize: '9px', color: '#a8a8c8', marginBottom: '4px' }}>
            {isMyTurn ? 'TU TURNO DE BANEO' : 'TURNO DEL OPONENTE'}
          </div>
          <div style={{ 
            fontSize: '28px', 
            fontFamily: 'monospace',
            color: timeLeft <= 10 ? '#fff' : '#e0c030',
            fontWeight: 'bold'
          }}>
            {formatTime(timeLeft)}
          </div>
        </div>

        {/* Bans Status */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <span style={{ fontSize: '9px', color: '#a8a8c8' }}>TUS BANS</span>
            <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
              {Array.from({ length: maxBans }, (_, i) => (
                <div 
                  key={i}
                  style={{
                    width: '32px',
                    height: '32px',
                    background: '#1a1a2e',
                    border: `2px solid ${myBans[i] ? '#c03030' : '#4a4a8a'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    color: myBans[i] ? '#c03030' : '#4a4a8a'
                  }}
                >
                  {myBans[i] ? '✕' : ''}
                </div>
              ))}
            </div>
          </div>
          
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '9px', color: '#a8a8c8' }}>PROGRESO</span>
            <p style={{ fontSize: '20px', color: '#e0c030', margin: '4px 0' }}>
              {bannedPokemon.length}/6
            </p>
            <div style={{ display: 'flex', gap: '8px', fontSize: '10px' }}>
              <span style={{ color: '#78c850' }}>P1: {player1Bans}</span>
              <span style={{ color: '#c03030' }}>P2: {player2Bans}</span>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '9px', color: '#a8a8c8' }}>BANS RESTANTES</span>
            <p style={{ fontSize: '14px', color: isMyTurn ? '#e0c030' : '#a8a8c8' }}>
              {maxBans - myBans.length}
            </p>
          </div>
        </div>

        <div class="ds-textbox" style={{ marginBottom: '16px' }}>
          <p style={{ fontSize: '10px', textAlign: 'center' }}>
            {isMyTurn 
              ? `Banea ${maxBans - myBans.length} Pokémon (turno ${bannedPokemon.length + 1})`
              : 'Esperando al oponente...'
            }
          </p>
        </div>

        {loading ? (
          <div class="loading" style={{ textAlign: 'center', padding: '40px' }}>
            Cargando Pokémon...
          </div>
        ) : (
          <div class="pokemon-grid" style={{ maxHeight: '280px' }}>
            {pokemons.map((pokemon) => {
              const isBanned = bannedPokemon.includes(pokemon.id.toString());
              const isMyPendingBan = myBans.includes(pokemon.id.toString());
              const canBan = !isBanned && isMyTurn && myBans.length < maxBans;
              
              return (
                <div
                  key={pokemon.id}
                  class={`pokemon-card ${canBan ? 'can-ban' : ''}`}
                  onClick={() => canBan && handleBan(pokemon.id.toString())}
                  style={{ 
                    opacity: isBanned ? 0.4 : 1,
                    borderColor: isMyPendingBan ? '#c03030' : 
                               isBanned ? '#705898' : 
                               canBan ? '#e0c030' : undefined,
                    cursor: canBan ? 'pointer' : (isBanned ? 'not-allowed' : 'default'),
                    transform: canBan ? 'scale(1.05)' : undefined,
                    boxShadow: canBan ? '0 0 10px rgba(224, 192, 48, 0.5)' : undefined
                  }}
                >
                  <img 
                    src={pokemon.spriteFront} 
                    alt={pokemon.name}
                    class="pokemon-sprite"
                  />
                  <p class="pokemon-name">{pokemon.name}</p>
                  {isBanned && (
                    <span style={{ 
                      fontSize: '7px', 
                      color: '#c03030',
                      background: '#1a1a2e',
                      padding: '2px 4px',
                      borderRadius: '2px',
                      marginTop: '4px'
                    }}>
                      BANEADO
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div class="nav-buttons" style={{ marginTop: '16px' }}>
          {allBansComplete && (
            <button class="ds-button gold" onClick={onBanComplete}>
              CONTINUAR A SELECCIÓN DE EQUIPO
            </button>
          )}
          {!allBansComplete && !isMyTurn && (
            <div style={{ 
              padding: '12px', 
              color: '#a8a8c8', 
              fontSize: '9px',
              background: '#1a1a2e',
              borderRadius: '4px',
              textAlign: 'center'
            }}>
              Esperando turno del oponente...
            </div>
          )}
        </div>
      </div>

      <style>{`
        .pokemon-card.can-ban:hover {
          transform: scale(1.1);
          box-shadow: 0 0 20px rgba(224, 192, 48, 0.7);
        }
      `}</style>
    </div>
  );
}