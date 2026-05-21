// Sinnoh Edition - Team Select Screen with Generation Filter, Search and Cache
import { useState, useEffect, useRef } from 'preact/hooks';
import type { Player } from '../App';
import { CONFIG, fetchPokemon, fetchPokemonMoves, getCachedPokemon, searchPokemon, setCachedPokemon, getPokemonSprite, getPokemonBackSprite, isGodModeActive, canUseShinyPokemon, canUseArceus, getPokemonSpriteWithGodMode } from '../lib/api';

interface TeamSelectProps {
  player: Player;
  bannedPokemon: string[];
  onTeamComplete: (team: any[]) => void;
}

interface PokemonData {
  id: number;
  name: string;
  types: string[];
  spriteFront: string;
  moves: any[];
  stats: any;
}

export function TeamSelect({ player: _player, bannedPokemon, onTeamComplete }: TeamSelectProps) {
  const [pokemons, setPokemons] = useState<PokemonData[]>([]);
  const [filteredPokemons, setFilteredPokemons] = useState<PokemonData[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [selectedPokemonMap, setSelectedPokemonMap] = useState<Record<number, PokemonData>>({});
  const [selectedGen, setSelectedGen] = useState<number | null>(null); // null = ALL
  const [searchQuery, setSearchQuery] = useState('');
  const [timeLeft, setTimeLeft] = useState(CONFIG.GAME_CONFIG.TEAM_TIMEOUT);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [godModeActive, setGodModeActive] = useState(false);
  const [shinyMode, setShinyMode] = useState(false);
  const selectedRef = useRef<number[]>([]);
  const selectedPokemonMapRef = useRef<Record<number, PokemonData>>({});
  const submittingRef = useRef(false);

  // Check God Mode on mount
  useEffect(() => {
    const gm = isGodModeActive();
    setGodModeActive(gm);
    setShinyMode(gm && canUseShinyPokemon());
  }, []);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    selectedPokemonMapRef.current = selectedPokemonMap;
  }, [selectedPokemonMap]);

  // Load pokemons by generation (when gen changes)
  useEffect(() => {
    const loadPokemons = async () => {
      setLoading(true);
      
      // Determine which generation to load
      let gen;
      if (selectedGen === null) {
        gen = { min: 1, max: 493 };
      } else {
        gen = CONFIG.GENERATIONS.find(g => g.id === selectedGen);
      }
      
      if (!gen) {
        setLoading(false);
        return;
      }
      
      // Load lightweight pokemon data in parallel. Moves are fetched only for the final team.
      const count = Math.min(gen.max - gen.min + 1, 150);
      const ids: number[] = [];
      for (let i = 0; i < count; i++) {
        const id = gen.min + i;
        if (bannedPokemon.includes(id.toString())) continue;
        if (id === 493 && !canUseArceus()) continue;
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
              moves: pokemon.moves || [],
              stats: pokemon.stats || {},
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
  }, [selectedGen, bannedPokemon.length, godModeActive]);

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
        if (rawPokemon.id === 493 && !canUseArceus()) return;

        const pokemon = toPokemonData(rawPokemon);
        setCachedPokemon(pokemon.id, rawPokemon);
        setFilteredPokemons(current => current.some(p => p.id === pokemon.id) ? current : [pokemon, ...current]);
        setPokemons(current => current.some(p => p.id === pokemon.id) ? current : [pokemon, ...current]);
      } catch {
        // Keep local filtered results when remote search has no match.
      }
    };

    if (query.length >= 2 || /^\d+$/.test(query)) {
      loadSearchResult();
    }

    return () => {
      cancelled = true;
    };
  }, [searchQuery, pokemons, bannedPokemon]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          submitRandomTeam(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const togglePokemon = (id: number) => {
    if (id === 493 && !canUseArceus()) return;

    if (selected.includes(id)) {
      setSelected(selected.filter(i => i !== id));
      setSelectedPokemonMap(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } else if (selected.length < CONFIG.GAME_CONFIG.MAX_POKEMON) {
      const pokemon = pokemons.find(p => p.id === id);
      setSelected([...selected, id]);
      if (pokemon) {
        setSelectedPokemonMap(prev => ({ ...prev, [id]: pokemon }));
      }
    }
  };

  const randomizeSelection = (fillExisting: boolean) => {
    const available = pokemons.filter(p => !selectedRef.current.includes(p.id));
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    const base = fillExisting ? selectedRef.current : [];
    const needed = CONFIG.GAME_CONFIG.MAX_POKEMON - base.length;
    const toAdd = shuffled.slice(0, needed);
    const ids = [...base, ...toAdd.map(p => p.id)];
    const mapped = Object.fromEntries([
      ...Object.entries(fillExisting ? selectedPokemonMapRef.current : {}),
      ...toAdd.map(p => [p.id, p]),
    ]);
    setSelected(ids);
    setSelectedPokemonMap(mapped as Record<number, PokemonData>);
    return { ids, mapped: mapped as Record<number, PokemonData> };
  };

  const submitRandomTeam = (fillExisting = false) => {
    if (submittingRef.current) return;
    const { ids, mapped } = randomizeSelection(fillExisting);
    handleStartBattle(ids, mapped);
  };

  // Get sprite based on God Mode
  const getDisplaySprite = (pokemon: PokemonData): string => {
    if (shinyMode && godModeActive) {
      return getPokemonSpriteWithGodMode(pokemon.id, true);
    }
    return pokemon.spriteFront;
  };

  const handleStartBattle = async (
    teamIds = selectedRef.current,
    pokemonMap = selectedPokemonMapRef.current
  ) => {
    if (teamIds.length < CONFIG.GAME_CONFIG.MIN_POKEMON || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    
    const team = (await Promise.all(teamIds.map(async (id) => {
      const pokemon = pokemonMap[id] || pokemons.find(p => p.id === id);
      if (!pokemon) return null;

      const movesResponse = await fetchPokemonMoves(id).catch(() => ({ moves: [] }));
      const availableMoves = movesResponse.moves?.length ? movesResponse.moves : getFallbackMoves(pokemon.types);
      const moves = [...availableMoves].sort(() => Math.random() - 0.5).slice(0, 4);
      
      const stats = normalizeStats(pokemon.stats);
      
      return {
        id: pokemon.id,
        name: pokemon.name,
        types: pokemon.types,
        spriteFront: pokemon.spriteFront,
        spriteBack: getPokemonBackSprite(pokemon.id),
        stats,
        moves,
        currentHp: stats.hp,
        maxHp: stats.hp,
        status: 'none',
        isActive: false,
        isFainted: false,
        godModeArceus: godModeActive && pokemon.id === 493,
      };
    }))).filter(Boolean);

    onTeamComplete(team);
    setSubmitting(false);
  };

  return (
    <div class="screen team-select">
      <div class="ds-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '12px', color: '#e0c030' }}>SELECCIÓN DE EQUIPO</h2>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '8px', color: '#a8a8c8' }}>TIEMPO</span>
            <p style={{ fontSize: '14px', color: timeLeft < 10 ? '#c03030' : '#e0c030' }}>
              {timeLeft}s
            </p>
          </div>
        </div>

        {/* Team slots */}
        <div class="team-panel" style={{ marginBottom: '12px' }}>
          {Array.from({ length: 6 }, (_, i) => {
            const pokemonId = selected[i];
            const pokemon = pokemonId ? selectedPokemonMap[pokemonId] : null;
            return (
              <div 
                key={i}
                class={`team-slot ${pokemon ? 'filled' : ''}`}
                onClick={() => pokemon && togglePokemon(pokemon.id)}
                style={{
                  background: pokemon ? '#1a1a2e' : '#0a0a1e',
                  borderColor: pokemon ? '#e0c030' : '#4a4a8a',
                }}
              >
                {pokemon ? (
                  <>
                    <img 
                      src={getDisplaySprite(pokemon)}
                      alt={pokemon.name}
                      style={{ width: '48px', height: '48px', imageRendering: 'pixelated' }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = getPokemonSprite(pokemon.id);
                      }}
                    />
                    <span style={{ fontSize: '7px', color: '#a8a8c8' }}>{pokemon.name.substring(0, 8)}</span>
                  </>
                ) : (
                  <span style={{ fontSize: '16px', color: '#4a4a8a' }}>?</span>
                )}
              </div>
            );
          })}
        </div>

        <p style={{ textAlign: 'center', fontSize: '9px', margin: '8px 0', color: '#a8a8c8' }}>
          {selected.length}/{CONFIG.GAME_CONFIG.MAX_POKEMON} Pokémon seleccionados
        </p>

        {/* Search */}
        <input
          type="text"
          class="ds-input"
          placeholder="Buscar por nombre o ID..."
          value={searchQuery}
          onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
          style={{ marginBottom: '8px', width: '100%' }}
        />

        {/* Generation Filter */}
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <button
            class={`ds-button ${selectedGen === null ? 'gold' : ''}`}
            onClick={() => setSelectedGen(null)}
            style={{ fontSize: '8px', padding: '4px 8px', minWidth: 'auto' }}
          >
            TODOS
          </button>
          {CONFIG.GENERATIONS.map(gen => (
            <button
              key={gen.id}
              class={`ds-button ${selectedGen === gen.id ? 'gold' : ''}`}
              onClick={() => setSelectedGen(gen.id)}
              style={{ fontSize: '8px', padding: '4px 8px', minWidth: 'auto' }}
            >
              {gen.name}
            </button>
          ))}
        </div>

        {/* Pokemon Grid */}
        {!loading ? (
          <div class="pokemon-grid" style={{ maxHeight: '220px' }}>
            {filteredPokemons.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#a8a8c8' }}>
                No se encontraron Pokémon
              </div>
            ) : (
              filteredPokemons.map((pokemon) => (
                <div
                  key={pokemon.id}
                  class={`pokemon-card ${selected.includes(pokemon.id) ? 'selected' : ''}`}
                  onClick={() => togglePokemon(pokemon.id)}
                  style={{
                    borderColor: selected.includes(pokemon.id) ? '#78c850' : undefined,
                    opacity: bannedPokemon.includes(pokemon.id.toString()) ? 0.4 : 1,
                  }}
                >
                  <img 
                    src={getDisplaySprite(pokemon)}
                    alt={pokemon.name} 
                    class="pokemon-sprite"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = getPokemonSprite(pokemon.id);
                    }}
                  />
                  <p class="pokemon-name">{pokemon.name}{shinyMode && godModeActive ? ' ✨' : ''}</p>
                  <p style={{ fontSize: '7px', color: '#a8a8c8' }}>#{pokemon.id}</p>
                  <div class="pokemon-types">
                    {pokemon.types.map((type: string) => (
                      <span 
                        key={type}
                        class="type-badge"
                        style={{ background: getTypeColor(type) }}
                      >
                        {type.substring(0, 3).toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div class="loading" style={{ textAlign: 'center', padding: '40px' }}>
            Cargando Pokémon...
          </div>
        )}

        <div class="nav-buttons" style={{ marginTop: '12px' }}>
          <button
            class="ds-button gold"
            onClick={() => randomizeSelection(false)}
            disabled={submitting || loading}
          >
            RANDOM
          </button>
          <button 
            class="ds-button"
            onClick={() => {
              setSelected([]);
              setSelectedPokemonMap({});
            }}
            disabled={selected.length === 0}
          >
            LIMPIAR
          </button>
          <button 
            class="ds-button"
            onClick={() => handleStartBattle()}
            disabled={selected.length < CONFIG.GAME_CONFIG.MIN_POKEMON || submitting}
          >
            {submitting ? 'PREPARANDO...' : `JUGAR (${selected.length})`}
          </button>
        </div>

        {/* God Mode Toggle (if active) */}
        {godModeActive && (
          <div style={{
            marginTop: '12px',
            padding: '8px',
            background: 'linear-gradient(180deg, #2a1a0a 0%, #1a1a2e 100%)',
            border: '2px solid #e0c030',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <p style={{ fontSize: '9px', color: '#e0c030', marginBottom: '8px' }}>✨ DIOS MODO ACTIVADO ✨</p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button
                class={`ds-button ${shinyMode ? 'gold' : ''}`}
                onClick={() => setShinyMode(!shinyMode)}
                style={{ fontSize: '8px' }}
              >
                {shinyMode ? 'SHINY ON' : 'SHINY OFF'}
              </button>
              {canUseArceus() && (
                <span style={{ fontSize: '8px', color: '#a8a8c8', alignSelf: 'center' }}>
                  🏆 Arceus desbloqueado
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function normalizeStats(stats: any) {
  if (!Array.isArray(stats)) {
    return {
      hp: stats?.hp || 100,
      attack: stats?.attack || 100,
      defense: stats?.defense || 100,
      specialAttack: stats?.specialAttack || stats?.['special-attack'] || 100,
      specialDefense: stats?.specialDefense || stats?.['special-defense'] || 100,
      speed: stats?.speed || 100,
    };
  }

  const statMap: Record<string, number> = {};
  stats.forEach((s: any) => {
    statMap[s.stat?.name || s.name] = s.base_stat || s.value || 100;
  });

  return {
    hp: statMap.hp || 100,
    attack: statMap.attack || 100,
    defense: statMap.defense || 100,
    specialAttack: statMap['special-attack'] || 100,
    specialDefense: statMap['special-defense'] || 100,
    speed: statMap.speed || 100,
  };
}

function toPokemonData(pokemon: any): PokemonData {
  return {
    id: pokemon.id,
    name: pokemon.name,
    types: pokemon.types?.map((t: any) => t.type?.name || t) || [],
    spriteFront: pokemon.spriteFront || pokemon.sprites?.front_default || getPokemonSprite(pokemon.id),
    moves: pokemon.moves || [],
    stats: pokemon.stats || {},
  };
}

function getFallbackMoves(types: string[]) {
  const primaryType = types[0] || 'normal';
  return [
    { id: 1, name: 'Tackle', type: 'normal', power: 40, accuracy: 100, pp: 35, maxPp: 35 },
    { id: 2, name: 'Quick Attack', type: 'normal', power: 40, accuracy: 100, pp: 30, maxPp: 30 },
    { id: 3, name: `${primaryType.charAt(0).toUpperCase()}${primaryType.slice(1)} Strike`, type: primaryType, power: 50, accuracy: 100, pp: 25, maxPp: 25 },
    { id: 4, name: 'Swift', type: 'normal', power: 60, accuracy: 100, pp: 20, maxPp: 20 },
  ];
}

function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    normal: '#A8A878', fire: '#F08030', water: '#6890F0', electric: '#F8D030',
    grass: '#78C850', ice: '#98D8D8', fighting: '#C03028', poison: '#A040A0',
    ground: '#E0C068', flying: '#A890F0', psychic: '#F85888', bug: '#A8B820',
    rock: '#B8A038', ghost: '#705898', dragon: '#7038F8', dark: '#705848',
    steel: '#B8B8D0', fairy: '#EE99AC',
  };
  return colors[type] || colors.normal;
}
