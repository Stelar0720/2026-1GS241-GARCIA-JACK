// Sinnoh Edition - Team Select Screen
import { useState, useEffect } from 'preact/hooks';
import type { Player } from '../../App';
import { fetchPokemon, shuffleArray, selectRandomMoves, CONFIG } from '../lib/api';

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
  spriteBack: string;
  moves: any[];
  stats: any;
}

export function TeamSelect({ player, bannedPokemon, onTeamComplete }: TeamSelectProps) {
  const [pokemons, setPokemons] = useState<PokemonData[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [useRandomFill, setUseRandomFill] = useState(false);
  const [showFillQuestion, setShowFillQuestion] = useState(true);
  const [timeLeft, setTimeLeft] = useState(CONFIG.GAME_CONFIG.TEAM_TIMEOUT);
  const [loading, setLoading] = useState(true);

  // Load pokemons
  useEffect(() => {
    const loadPokemons = async () => {
      // Load first 100 pokemons for selection
      const ids = Array.from({ length: 100 }, (_, i) => i + 1);
      const loaded = await Promise.all(
        ids.map(async (id) => {
          if (bannedPokemon.includes(id.toString())) return null;
          try {
            const data = await fetchPokemon(id);
            return data;
          } catch {
            return null;
          }
        })
      );
      setPokemons(loaded.filter(Boolean) as PokemonData[]);
      setLoading(false);
    };
    loadPokemons();
  }, [bannedPokemon]);

  // Timer
  useEffect(() => {
    if (showFillQuestion || selected.length === 0) return;
    
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          handleRandomFill();
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showFillQuestion, selected.length > 0]);

  const togglePokemon = (id: number) => {
    if (selected.includes(id)) {
      setSelected(selected.filter(i => i !== id));
    } else if (selected.length < CONFIG.GAME_CONFIG.MAX_POKEMON) {
      setSelected([...selected, id]);
    }
  };

  const handleRandomFill = () => {
    const available = pokemons.filter(p => !selected.includes(p.id));
    const shuffled = shuffleArray(available);
    const needed = CONFIG.GAME_CONFIG.MAX_POKEMON - selected.length;
    const toAdd = shuffled.slice(0, needed);
    setSelected([...selected, ...toAdd.map(p => p.id)]);
    setShowFillQuestion(false);
  };

  const handleStartBattle = () => {
    if (selected.length < CONFIG.GAME_CONFIG.MIN_POKEMON) return;
    
    const team = selected.map(id => {
      const pokemon = pokemons.find(p => p.id === id);
      if (!pokemon) return null;
      
      // Assign 4 random moves
      const moves = selectRandomMoves(pokemon.moves || [], 4);
      
      return {
        id: pokemon.id,
        name: pokemon.name,
        types: pokemon.types,
        spriteFront: pokemon.spriteFront,
        spriteBack: pokemon.spriteBack,
        stats: pokemon.stats,
        moves,
        currentHp: pokemon.stats.hp,
        maxHp: pokemon.stats.hp,
        status: 'none',
        isActive: false,
        isFainted: false,
      };
    }).filter(Boolean);

    onTeamComplete(team);
  };

  return (
    <div class="screen team-select">
      <div class="ds-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '12px', color: '#e0c030' }}>SELECCIÓN DE EQUIPO</h2>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '8px', color: '#a8a8c8' }}>TIEMPO</span>
            <p style={{ 
              fontSize: '14px', 
              color: timeLeft < 10 ? '#c03030' : '#e0c030' 
            }}>
              {timeLeft}s
            </p>
          </div>
        </div>

        {/* Team Preview */}
        <div class="team-panel">
          {Array.from({ length: 6 }, (_, i) => {
            const pokemon = pokemons.find(p => selected.includes(p.id));
            return (
              <div 
                key={i}
                class={`team-slot ${pokemon ? 'filled' : ''}`}
                onClick={() => pokemon && togglePokemon(pokemon.id)}
              >
                {pokemon && (
                  <img 
                    src={pokemon.spriteFront}
                    alt={pokemon.name}
                    style={{ width: '48px', height: '48px', imageRendering: 'pixelated' }}
                  />
                )}
              </div>
            );
          })}
        </div>

        <p style={{ textAlign: 'center', fontSize: '9px', margin: '12px 0', color: '#a8a8c8' }}>
          {selected.length}/{CONFIG.GAME_CONFIG.MAX_POKEMON} Pokémon seleccionados
        </p>

        {/* Fill Question */}
        {showFillQuestion && selected.length > 0 && selected.length < CONFIG.GAME_CONFIG.MAX_POKEMON && (
          <div class="ds-textbox" style={{ marginBottom: '16px' }}>
            <p style={{ fontSize: '9px', textAlign: 'center', marginBottom: '12px' }}>
              ¿Deseas rellenar el equipo automáticamente?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button class="ds-button gold" onClick={handleRandomFill}>
                SÍ, RELLENAR
              </button>
              <button class="ds-button" onClick={() => setShowFillQuestion(false)}>
                NO, JUGAR ASÍ
              </button>
            </div>
          </div>
        )}

        {/* Pokemon Grid */}
        {!loading && (
          <div class="pokemon-grid" style={{ maxHeight: '250px' }}>
            {pokemons.map((pokemon) => (
              <div
                key={pokemon.id}
                class={`pokemon-card ${selected.includes(pokemon.id) ? 'selected' : ''}`}
                onClick={() => togglePokemon(pokemon.id)}
              >
                <img 
                  src={pokemon.spriteFront} 
                  alt={pokemon.name}
                  class="pokemon-sprite"
                />
                <p class="pokemon-name">{pokemon.name}</p>
                <div class="pokemon-types">
                  {pokemon.types.map((type: string) => (
                    <span 
                      key={type}
                      class={`type-badge type-${type}`}
                      style={{ background: getTypeColor(type) }}
                    >
                      {type.substring(0, 3).toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {loading && (
          <div class="loading" style={{ textAlign: 'center', padding: '40px' }}>
            Cargando Pokémon...
          </div>
        )}

        {/* Actions */}
        <div class="nav-buttons">
          <button 
            class="ds-button"
            onClick={() => setSelected([])}
            disabled={selected.length === 0}
          >
            LIMPIAR
          </button>
          <button 
            class="ds-button gold"
            onClick={handleStartBattle}
            disabled={selected.length < CONFIG.GAME_CONFIG.MIN_POKEMON}
          >
            INICIAR BATALLA
          </button>
        </div>
      </div>
    </div>
  );
}

function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    normal: '#A8A878',
    fire: '#F08030',
    water: '#6890F0',
    electric: '#F8D030',
    grass: '#78C850',
    ice: '#98D8D8',
    fighting: '#C03028',
    poison: '#A040A0',
    ground: '#E0C068',
    flying: '#A890F0',
    psychic: '#F85888',
    bug: '#A8B820',
    rock: '#B8A038',
    ghost: '#705898',
    dragon: '#7038F8',
    dark: '#705848',
    steel: '#B8B8D0',
    fairy: '#EE99AC',
  };
  return colors[type] || colors.normal;
}
