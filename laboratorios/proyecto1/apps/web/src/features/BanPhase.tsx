// Sinnoh Edition - Ban Phase Screen
import { useState, useEffect } from 'preact/hooks';
import type { Player, Room } from '../../App';
import { fetchPokemon, CONFIG, banPokemon, shuffleArray } from '../lib/api';

interface BanPhaseProps {
  player: Player;
  room: Room;
  bannedPokemon: string[];
  onBanComplete: () => void;
}

interface PokemonOption {
  id: number;
  name: string;
  spriteUrl: string;
  banned: boolean;
}

export function BanPhase({ player, room, bannedPokemon, onBanComplete }: BanPhaseProps) {
  const [pokemons, setPokemons] = useState<PokemonOption[]>([]);
  const [myBans, setMyBans] = useState<string[]>([]);
  const [opponentBans, setOpponentBans] = useState<string[]>([]);
  const [turn, setTurn] = useState<'ban' | 'select'>('ban');
  const [maxBans] = useState(3);

  // Load initial pokemons
  useEffect(() => {
    const loadPokemons = async () => {
      // Load Sinnoh (gen 4) pokemons for demo
      const gen4Ids = Array.from({ length: 50 }, (_, i) => i + 387);
      const loaded = await Promise.all(
        gen4Ids.map(async (id) => {
          const data = await fetchPokemon(id).catch(() => null);
          if (!data) return null;
          return {
            id: data.id,
            name: data.name,
            spriteUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`,
            banned: bannedPokemon.includes(id.toString()),
          };
        })
      );
      setPokemons(loaded.filter(Boolean) as PokemonOption[]);
    };
    loadPokemons();
  }, []);

  const handleBan = (pokemonId: string) => {
    if (myBans.length >= maxBans) return;
    if (myBans.includes(pokemonId)) return;

    const newMyBans = [...myBans, pokemonId];
    setMyBans(newMyBans);
    
    // Update cache
    banPokemon(room.id, pokemonId);
    
    // Check if ban phase complete
    if (newMyBans.length >= maxBans) {
      setTurn('select');
    }
  };

  const handleContinue = () => {
    if (myBans.length >= maxBans) {
      onBanComplete();
    }
  };

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
                  {myBans[i] ? 'X' : ''}
                </div>
              ))}
            </div>
          </div>
          
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '9px', color: '#a8a8c8' }}>FASE</span>
            <p style={{ fontSize: '10px', color: '#e0c030' }}>
              {turn === 'ban' ? 'BANS' : 'SELECCIÓN'}
            </p>
          </div>
        </div>

        <div class="ds-textbox" style={{ marginBottom: '16px' }}>
          <p style={{ fontSize: '10px', textAlign: 'center' }}>
            {turn === 'ban' 
              ? `Banea ${maxBans - myBans.length} Pokémon para tu oponente`
              : '¿Listo para continuar?'
            }
          </p>
        </div>

        <div class="pokemon-grid" style={{ maxHeight: '300px' }}>
          {pokemons.map((pokemon) => (
            <div
              key={pokemon.id}
              class={`pokemon-card ${pokemon.banned || myBans.includes(pokemon.id.toString()) ? 'selected' : ''}`}
              onClick={() => !pokemon.banned && turn === 'ban' && handleBan(pokemon.id.toString())}
              style={{ 
                opacity: pokemon.banned || myBans.includes(pokemon.id.toString()) ? 0.5 : 1,
                borderColor: myBans.includes(pokemon.id.toString()) ? '#c03030' : undefined
              }}
            >
              <img 
                src={pokemon.spriteUrl} 
                alt={pokemon.name}
                class="pokemon-sprite"
              />
              <p class="pokemon-name">{pokemon.name}</p>
            </div>
          ))}
        </div>

        <div class="nav-buttons">
          {turn === 'ban' && myBans.length >= maxBans && (
            <button class="ds-button gold" onClick={handleContinue}>
              CONTINUAR
            </button>
          )}
          {turn === 'ban' && myBans.length < maxBans && (
            <div class="loading" style={{ padding: '12px', fontSize: '9px' }}>
              Esperando... ({myBans.length}/{maxBans})
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
