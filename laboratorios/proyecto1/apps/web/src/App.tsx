// Sinnoh Edition - Main App Component
import { useState, useEffect } from 'preact/hooks';
import { ChampionSelect } from './features/ChampionSelect';
import { Lobby } from './features/Lobby';
import { BanPhase } from './features/BanPhase';
import { TeamSelect } from './features/TeamSelect';
import { Battle } from './features/Battle';
import { Results } from './features/Results';
import { loadLocalStorage } from './lib/api';

export type Screen = 'champion-select' | 'lobby' | 'ban' | 'team-select' | 'battle' | 'results';

export interface Player {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'other';
  spriteUrl: string;
}

export interface GameStore {
  screen: Screen;
  player: Player | null;
  room: Room | null;
  bannedPokemon: string[];
  playerTeam: any[];
  opponentTeam: any[];
}

interface Room {
  id: string;
  code: string;
  opponent: string | null;
  status: string;
}

export function App() {
  const [store, setStore] = useState<GameStore>({
    screen: 'champion-select',
    player: null,
    room: null,
    bannedPokemon: [],
    playerTeam: [],
    opponentTeam: [],
  });

  // Load saved player on mount
  useEffect(() => {
    const savedPlayer = loadLocalStorage<Player | null>('player', null);
    if (savedPlayer) {
      setStore(s => ({ ...s, player: savedPlayer }));
    }
  }, []);

  const updateStore = (updates: Partial<GameStore>) => {
    setStore(prev => ({ ...prev, ...updates }));
  };

  const goToScreen = (screen: Screen) => {
    updateStore({ screen });
  };

  return (
    <div class="app-container">
      <header class="app-header">
        <h1 class="app-title"> Sinnoh Edition</h1>
        <p class="app-subtitle">Pokémon World Championships</p>
      </header>

      <main class="main-content">
        {store.screen === 'champion-select' && (
          <ChampionSelect 
            player={store.player}
            onComplete={(player) => {
              updateStore({ player, screen: 'lobby' });
            }}
          />
        )}

        {store.screen === 'lobby' && store.player && (
          <Lobby
            player={store.player}
            room={store.room}
            onCreateRoom={(room) => updateStore({ room })}
            onJoinRoom={(room) => updateStore({ room })}
            onStartBan={() => goToScreen('ban')}
            bannedPokemon={store.bannedPokemon}
            onBannedChange={(banned) => updateStore({ bannedPokemon: banned })}
          />
        )}

        {store.screen === 'ban' && store.player && store.room && (
          <BanPhase
            player={store.player}
            room={store.room}
            bannedPokemon={store.bannedPokemon}
            onBanComplete={() => goToScreen('team-select')}
          />
        )}

        {store.screen === 'team-select' && store.player && (
          <TeamSelect
            player={store.player}
            bannedPokemon={store.bannedPokemon}
            onTeamComplete={(team) => {
              updateStore({ playerTeam: team });
              goToScreen('battle');
            }}
          />
        )}

        {store.screen === 'battle' && store.player && (
          <Battle
            player={store.player}
            playerTeam={store.playerTeam}
            opponentTeam={store.opponentTeam}
            onBattleEnd={() => goToScreen('results')}
          />
        )}

        {store.screen === 'results' && (
          <Results
            player={store.player}
            playerTeam={store.playerTeam}
            opponentTeam={store.opponentTeam}
            onPlayAgain={() => {
              updateStore({ 
screen: 'lobby', 
                playerTeam: [], 
                opponentTeam: [],
                bannedPokemon: [],
              });
            }}
          />
        )}
      </main>

      <footer class="legal-footer">
        Proyecto universitario desarrollado únicamente con fines educativos y académicos. 
        No está afiliado, asociado, autorizado ni patrocinado por Nintendo, Game Freak, 
        The Pokémon Company ni sus marcas relacionadas.
      </footer>
    </div>
  );
}
