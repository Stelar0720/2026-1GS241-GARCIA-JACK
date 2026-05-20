// Sinnoh Edition - Ban Phase Screen with Filters and Search
import { useState, useEffect } from 'preact/hooks';
import type { Player, Room } from '../App';
import { CONFIG, fetchPokemon, getCachedPokemon, searchPokemon, setCachedPokemon, getPokemonSprite } from '../lib/api';

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

interface PokemonData {
  id: number;
  name: string;
  types: string[];
  spriteFront: string;
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
  const [pokemons, setPokemons] = useState<PokemonData[]>([]);
  const [filteredPokemons, setFilteredPokemons] = useState<PokemonData[]>([]);
  const [myBans, setMyBans] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(timeRemaining);
  const [selectedGen, setSelectedGen] = useState<number | null>(null); // null = ALL
  const [searchQuery, setSearchQuery] = useState('');
  const maxBans = 6;

  const isMyTurn = currentBanTurn === player.id;

  useEffect(() => {
    setTimeLeft(timeRemaining);
  }, [timeRemaining]);

  // Load pokemons by generation (when gen changes)
  useEffect(() => {
    const loadPokemons = async () => {
      setLoading(true);
      // Determine which generation range to load
      let genRange;
      if (selectedGen === null) {
        genRange = { min: 1, max: 493 };
      } else {
        const gen = CONFIG.GENERATIONS.find(g => g.id === selectedGen);
        if (!gen) {
          setLoading(false);
          return;
        }
        genRange = { min: gen.min, max: gen.max };
      }
      
      // Load lightweight pokemon data in parallel; this keeps the ban phase responsive.
      const count = Math.min(genRange.max - genRange.min + 1, 150);
      const ids: number[] = [];
      for (let i = 0; i < count; i++) {
        const id = genRange.min + i;
        if (bannedPokemon.includes(id.toString())) continue;
        ids.push(id);
      }

      const loadedPokemon = (await Promise.all(ids.map(async (id) => {
        try {
          let pokemon = getCachedPokemon(id);
          if (!pokemon) {
            pokemon = await fetchPokemon(id);
            setCachedPokemon(id, pokemon);
          }
          
          if (pokemon) {
            return {
              id: pokemon.id,
              name: pokemon.name,
              types: pokemon.types?.map((t: any) => t.type?.name || t) || [],
              spriteFront: pokemon.spriteFront || pokemon.sprites?.front_default || getPokemonSprite(pokemon.id),
            };
          }
        } catch (error) {
          console.error(`Error loading pokemon ${id}:`, error);
        }
        return null;
      }))).filter(Boolean) as PokemonData[];
      
      setPokemons(loadedPokemon);
      setFilteredPokemons(loadedPokemon);
      setLoading(false);
    };
    loadPokemons();
  }, [selectedGen, bannedPokemon.length]);

  useEffect(() => {
    let cancelled = false;

    if (!searchQuery.trim()) {
      setFilteredPokemons(pokemons);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = pokemons.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.id.toString().includes(query)
    );
    setFilteredPokemons(filtered);

    const loadSearchResult = async () => {
      try {
        const rawPokemon = /^\d+$/.test(query)
          ? await fetchPokemon(Number(query))
          : await searchPokemon(query);
        if (!rawPokemon || bannedPokemon.includes(String(rawPokemon.id)) || cancelled) return;

        const pokemon = {
          id: rawPokemon.id,
          name: rawPokemon.name,
          types: rawPokemon.types?.map((t: any) => t.type?.name || t) || [],
          spriteFront: rawPokemon.spriteFront || rawPokemon.sprites?.front_default || getPokemonSprite(rawPokemon.id),
        };
        setCachedPokemon(pokemon.id, rawPokemon);
        setFilteredPokemons(current => current.some(p => p.id === pokemon.id) ? current : [pokemon, ...current]);
        setPokemons(current => current.some(p => p.id === pokemon.id) ? current : [pokemon, ...current]);
      } catch {
        // Keep local filtered results if remote search has no match.
      }
    };

    if (query.length >= 2 || /^\d+$/.test(query)) {
      loadSearchResult();
    }

    return () => {
      cancelled = true;
    };
  }, [searchQuery, bannedPokemon.length]);

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

  const allBansComplete = bannedPokemon.length >= maxBans * 2;

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
              {bannedPokemon.length}/{maxBans * 2}
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

        {/* Search and Filters */}
        <div style={{ marginBottom: '12px' }}>
          <input
            type="text"
            class="ds-input"
            placeholder="Buscar por nombre o ID..."
            value={searchQuery}
            onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
            style={{ marginBottom: '8px', width: '100%' }}
          />
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            <button
              class={`ds-button ${selectedGen === null ? 'gold' : ''}`}
              onClick={() => setSelectedGen(null)}
              style={{ 
                fontSize: '8px', 
                padding: '4px 8px',
                minWidth: 'auto'
              }}
            >
              TODOS
            </button>
            {CONFIG.GENERATIONS.map(gen => (
              <button
                key={gen.id}
                class={`ds-button ${selectedGen === gen.id ? 'gold' : ''}`}
                onClick={() => setSelectedGen(gen.id)}
                style={{ 
                  fontSize: '8px', 
                  padding: '4px 8px',
                  minWidth: 'auto'
                }}
              >
                {gen.name}
              </button>
            ))}
          </div>
        </div>

        <div class="ds-textbox" style={{ marginBottom: '12px' }}>
          <p style={{ fontSize: '10px', textAlign: 'center', color: '#e0c030', marginBottom: '6px' }}>
            Hola, {player.name}. Prepara tus bans para abrir el camino al titulo.
          </p>
          <p style={{ fontSize: '10px', textAlign: 'center' }}>
            {isMyTurn 
              ? `Banea ${maxBans - myBans.length} Pokémon`
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
            {filteredPokemons.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#a8a8c8' }}>
                No se encontraron Pokémon
              </div>
            ) : (
              filteredPokemons.map((pokemon) => {
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
                      src={pokemon.spriteFront || getPokemonSprite(pokemon.id)} 
                      alt={pokemon.name}
                      class="pokemon-sprite"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = getPokemonSprite(pokemon.id);
                      }}
                    />
<p class="pokemon-name">{pokemon.name}</p>
                    <p style={{ fontSize: '7px', color: '#a8a8c8' }}>#{pokemon.id}</p>
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
              })
            )}
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
