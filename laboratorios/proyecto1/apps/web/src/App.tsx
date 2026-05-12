// Sinnoh Edition - Main App Component with WebSocket
import { useState, useEffect } from 'preact/hooks';
import { ChampionSelect } from './features/ChampionSelect';
import { Lobby } from './features/Lobby';
import { BanPhase } from './features/BanPhase';
import { TeamSelect } from './features/TeamSelect';
import { Battle } from './features/Battle';
import { Results } from './features/Results';
import { loadLocalStorage } from './lib/api';
import { initWebSocket, wsActions } from './lib/websocket';
import type { WSMessage } from './lib/websocket';

export type Screen = 'champion-select' | 'lobby' | 'ban' | 'team-select' | 'pre-battle' | 'battle' | 'results';

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
  opponent: Player | null;
  bannedPokemon: string[];
  playerTeam: any[];
  opponentTeam: any[];
  isConnected: boolean;
  isOpponentReady: boolean;
  gamePhase: 'waiting' | 'champion_select' | 'ban_phase' | 'team_select' | 'pre_battle' | 'battle' | 'finished';
}

export interface Room {
  id: string;
  code: string;
  status: string;
  player1Id?: string;
  player2Id?: string;
}

export function App() {
  const [store, setStore] = useState<GameStore>({
    screen: 'champion-select',
    player: null,
    room: null,
    opponent: null,
    bannedPokemon: [],
    playerTeam: [],
    opponentTeam: [],
    isConnected: false,
    isOpponentReady: false,
    gamePhase: 'waiting',
  });

  // Load saved player and register WebSocket
  useEffect(() => {
    const savedPlayer = loadLocalStorage<Player | null>('player', null);
    if (savedPlayer) {
      setStore(s => ({ ...s, player: savedPlayer }));
      
      // Initialize WebSocket connection
      initWebSocket(savedPlayer.id, {
        onConnect: () => {
          setStore(s => ({ ...s, isConnected: true }));
          // Register player
          wsActions.register(savedPlayer.id, savedPlayer.name, savedPlayer.gender, savedPlayer.spriteUrl);
        },
        onDisconnect: () => {
          setStore(s => ({ ...s, isConnected: false }));
        },
        onMessage: (msg: WSMessage) => handleWebSocketMessage(msg),
        onError: (error) => console.error('WS Error:', error),
      });
    }
  }, []);

  // Handle WebSocket messages
  const handleWebSocketMessage = (msg: WSMessage) => {
    console.log('WS Message:', msg.type, msg.payload);
    
    switch (msg.type) {
      case 'registered':
        console.log('Player registered:', msg.payload);
        break;

      case 'room_created':
        setStore(s => ({
          ...s,
          room: { id: msg.payload.roomId, code: msg.payload.code, status: msg.payload.status },
          screen: 'lobby',
        }));
        break;

      case 'room_joined':
        setStore(s => ({
          ...s,
          room: { id: msg.payload.roomId, code: msg.payload.code, status: msg.payload.status },
          screen: 'lobby',
        }));
        break;

      case 'opponent_joined':
        setStore(s => ({
          ...s,
          opponent: { id: msg.payload.opponentId, name: 'Oponente', gender: 'other', spriteUrl: '' },
        }));
        break;

      case 'opponent_left':
        setStore(s => ({
          ...s,
          opponent: null,
        }));
        break;

      case 'player_ready':
        setStore(s => ({ ...s, isOpponentReady: true }));
        break;

      case 'phase_change':
        handlePhaseChange(msg.payload);
        break;

      case 'pokemon_banned':
        setStore(s => ({
          ...s,
          bannedPokemon: [...s.bannedPokemon, msg.payload.pokemonId],
        }));
        break;

      case 'team_selected':
        // Opponent selected their team
        break;

      case 'battle_update':
        handleBattleUpdate(msg.payload);
        break;

      case 'error':
        console.error('Server error:', msg.payload.message);
        break;
    }
  };

  const handlePhaseChange = (payload: any) => {
    switch (payload.phase) {
      case 'champion_select':
        setStore(s => ({ ...s, gamePhase: 'champion_select', screen: 'lobby' }));
        break;
      
      case 'ban_phase':
        setStore(s => ({ ...s, gamePhase: 'ban_phase', screen: 'ban' }));
        break;
      
      case 'team_select':
        setStore(s => ({ 
          ...s, 
          gamePhase: 'team_select',
          bannedPokemon: payload.bans || [],
          screen: 'team-select' 
        }));
        break;
      
      case 'pre_battle':
        setStore(s => ({ ...s, gamePhase: 'pre_battle', screen: 'battle' }));
        break;
      
      case 'battle':
        setStore(s => ({ ...s, gamePhase: 'battle', screen: 'battle' }));
        break;
      
      case 'finished':
        setStore(s => ({ ...s, gamePhase: 'finished', screen: 'results' }));
        break;
    }
  };

  const handleBattleUpdate = (payload: any) => {
    // Handle battle actions from opponent
    console.log('Battle update:', payload);
  };

  const updateStore = (updates: Partial<GameStore>) => {
    setStore(prev => ({ ...prev, ...updates }));
  };

  const goToScreen = (screen: Screen) => {
    updateStore({ screen });
  };

  return (
    <div class="app-container">
      {/* Connection Status */}
      <div style={{ 
        position: 'fixed', 
        top: '10px', 
        right: '10px',
        padding: '4px 8px',
        background: store.isConnected ? '#78c850' : '#c03030',
        borderRadius: '4px',
        fontSize: '8px',
        zIndex: 1000,
        color: '#1a1a2e'
      }}>
        {store.isConnected ? '● CONECTADO' : '○ DESCONECTADO'}
      </div>

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
            opponent={store.opponent}
            isOpponentReady={store.isOpponentReady}
            onCreateRoom={() => wsActions.createRoom(store.player!.id)}
            onJoinRoom={(code) => wsActions.joinRoom(store.player!.id, code)}
            onReady={() => wsActions.ready(store.player!.id)}
            onStartBan={() => goToScreen('ban')}
            isConnected={store.isConnected}
          />
        )}

        {store.screen === 'ban' && store.player && store.room && (
          <BanPhase
            player={store.player}
            room={store.room}
            bannedPokemon={store.bannedPokemon}
            onBan={(pokemonId) => wsActions.banPokemon(store.player!.id, pokemonId)}
            onBanComplete={() => goToScreen('team-select')}
          />
        )}

        {store.screen === 'team-select' && store.player && (
          <TeamSelect
            player={store.player}
            bannedPokemon={store.bannedPokemon}
            onTeamComplete={(team) => {
              wsActions.selectTeam(store.player!.id, team);
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
            onAttack={(action, data) => wsActions.battleAction(store.player!.id, action, data)}
            onSwitch={(pokemonId) => wsActions.switchPokemon(store.player!.id, pokemonId)}
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
                opponent: null,
                isOpponentReady: false,
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
