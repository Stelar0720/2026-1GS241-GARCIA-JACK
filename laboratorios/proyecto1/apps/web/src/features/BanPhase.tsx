// Sinnoh Edition - Ban Phase Screen with WebSocket
import { useState, useEffect } from 'preact/hooks';
import type { Player, Room } from '../App';
import { fetchPokemon } from '../lib/api';

interface BanPhaseProps {
  player: Player;
  room: Room;
  bannedPokemon: string[];
  onBan: (pokemonId: string) => void;
  onBanComplete: () => void;
}

export function BanPhase({ player: _player, room: _room, bannedPokemon, onBan, onBanComplete }: BanPhaseProps) {
  const [pokemons, setPokemons] = useState<any[]>([]);
  const [myBans, setMyBans] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const maxBans = 3;

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
    if (myBans.length >= maxBans) return;
    if (bannedPokemon.includes(pokemonId)) return;

    setMyBans([...myBans, pokemonId]);
    onBan(pokemonId);
  };

  // Auto advance when both players have banned
  const totalBans = [...new Set([...bannedPokemon, ...myBans])].length;

  return (
    <div class="screen ban-phase">
      <div class="ds-panel">
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
                    border: '2px solid #4a4a8a',
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
          
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '9px', color: '#a8a8c8' }}>BANS TOTALES</span>
            <p style={{ fontSize: '14px', color: '#e0c030' }}>{totalBans}/6</p>
          </div>
        </div>

        <div class="ds-textbox" style={{ marginBottom: '16px' }}>
          <p style={{ fontSize: '10px', textAlign: 'center' }}>
            Banea {maxBans - myBans.length} Pokémon ({totalBans} baneados en total)
          </p>
        </div>

        {loading ? (
          <div class="loading" style={{ textAlign: 'center', padding: '40px' }}>
            Cargando Pokémon...
          </div>
        ) : (
          <div class="pokemon-grid" style={{ maxHeight: '300px' }}>
            {pokemons.map((pokemon) => {
              const isBanned = bannedPokemon.includes(pokemon.id.toString()) || myBans.includes(pokemon.id.toString());
              return (
                <div
                  key={pokemon.id}
                  class="pokemon-card"
                  onClick={() => !isBanned && handleBan(pokemon.id.toString())}
                  style={{ 
                    opacity: isBanned ? 0.5 : 1,
                    borderColor: myBans.includes(pokemon.id.toString()) ? '#c03030' : 
                               bannedPokemon.includes(pokemon.id.toString()) ? '#705898' : undefined,
                    cursor: isBanned ? 'not-allowed' : 'pointer'
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

        <div class="nav-buttons">
          {totalBans >= 6 && (
            <button class="ds-button gold" onClick={onBanComplete}>
              CONTINUAR A SELECCIÓN
            </button>
          )}
          {totalBans < 6 && (
            <div style={{ padding: '12px', color: '#a8a8c8', fontSize: '9px' }}>
              Esperando a que el otro jugador complete sus bans...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
