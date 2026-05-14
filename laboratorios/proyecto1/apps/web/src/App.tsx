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
  // Ban phase state
  currentBanTurn: string | null;
  banPhaseStartTime: number | null;
  timeRemaining: number;
  player1Bans: number;
  player2Bans: number;
}

export interface Room {
  id: string;
  code: string;
  status: string;
  player1Id?: string;
  player2Id?: string;
  currentBanTurn?: string | null;
  banPhaseStartTime?: number | null;
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
    currentBanTurn: null,
    banPhaseStartTime: null,
    timeRemaining: 60,
    player1Bans: 0,
    player2Bans: 0,
  });

  const connectPlayer = (player: Player) => {
    initWebSocket(player.id, {
      onConnect: () => {
        setStore(s => ({ ...s, isConnected: true }));
        wsActions.register(player.id, player.name, player.gender, player.spriteUrl);
      },
      onDisconnect: () => {
        setStore(s => ({ ...s, isConnected: false }));
      },
      onMessage: (msg: WSMessage) => handleWebSocketMessage(msg),
      onError: (error) => console.error('WS Error:', error),
    });
  };

  // Load saved player and register WebSocket
  useEffect(() => {
    const savedPlayer = loadLocalStorage<Player | null>('player', null);
    if (savedPlayer) {
      setStore(s => ({ ...s, player: savedPlayer }));
      connectPlayer(savedPlayer);
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
          room: { id: msg.payload.roomId, code: msg.payload.code, status: msg.payload.status, player1Id: s.player?.id },
          screen: 'lobby',
        }));
        break;

      case 'room_joined':
        setStore(s => ({
          ...s,
          room: { 
            id: msg.payload.roomId, 
            code: msg.payload.code, 
            status: msg.payload.status,
            player1Id: msg.payload.player1Id,
            player2Id: s.player?.id,
          },
          opponent: { id: msg.payload.player1Id, name: 'Oponente', gender: 'other', spriteUrl: '' },
          screen: 'lobby',
        }));
        break;

      case 'opponent_joined':
        setStore(s => ({
          ...s,
          room: s.room ? { ...s.room, player2Id: msg.payload.opponentId } : s.room,
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
        setStore(s => (
          msg.payload.playerId !== s.player?.id 
            ? { ...s, isOpponentReady: true }
            : s
        ));
        break;

      case 'phase_change':
        handlePhaseChange(msg.payload);
        break;

      case 'pokemon_banned':
        handlePokemonBanned(msg.payload);
        break;

      case 'ban_timer':
        setStore(s => ({
          ...s,
          timeRemaining: msg.payload.timeRemaining,
        }));
        break;

      case 'ban_timer_update':
        setStore(s => ({
          ...s,
          timeRemaining: msg.payload.timeRemaining,
          currentBanTurn: msg.payload.currentTurn,
        }));
        break;

      case 'ban_skipped':
        setStore(s => ({
          ...s,
          currentBanTurn: msg.payload.nextTurn,
          timeRemaining: msg.payload.timeRemaining || 60,
        }));
        break;

      case 'ban_turn_changed':
        setStore(s => ({
          ...s,
          currentBanTurn: msg.payload.currentTurn,
          player1Bans: msg.payload.player1Bans || 0,
          player2Bans: msg.payload.player2Bans || 0,
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
        // Show error to user
        if (msg.payload.message === 'Not your turn to ban') {
          alert('¡No es tu turno de banear!');
        }
        break;
    }
  };

  const handlePokemonBanned = (payload: any) => {
    setStore(s => {
      const newBanned = [...s.bannedPokemon, payload.pokemonId];
      const isPlayer1 = s.room?.player1Id === payload.playerId;
      
      return {
        ...s,
        bannedPokemon: newBanned,
        player1Bans: isPlayer1 ? s.player1Bans + 1 : s.player1Bans,
        player2Bans: !isPlayer1 ? s.player2Bans + 1 : s.player2Bans,
      };
    });
  };

  const handlePhaseChange = (payload: any) => {
    switch (payload.phase) {
      case 'champion_select':
        setStore(s => ({ ...s, gamePhase: 'champion_select', screen: 'lobby' }));
        break;
      
      case 'ban_phase':
        setStore(s => ({ 
          ...s, 
          gamePhase: 'ban_phase',
          screen: 'ban',
          currentBanTurn: payload.currentBanTurn || null,
          banPhaseStartTime: payload.banPhaseStartTime || null,
          timeRemaining: payload.timeRemaining || 60,
          bannedPokemon: payload.bans || [],
          player1Bans: 0,
          player2Bans: 0,
        }));
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
              connectPlayer(player);
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
            isConnected={store.isConnected}
          />
        )}

        {store.screen === 'ban' && store.player && store.room && (
          <BanPhase
            player={store.player}
            room={store.room}
            bannedPokemon={store.bannedPokemon}
            currentBanTurn={store.currentBanTurn}
            onBan={(pokemonId) => wsActions.banPokemon(store.player!.id, pokemonId)}
            onBanComplete={() => goToScreen('team-select')}
            timeRemaining={store.timeRemaining}
            player1Bans={store.player1Bans}
            player2Bans={store.player2Bans}
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
                currentBanTurn: null,
                timeRemaining: 60,
                player1Bans: 0,
                player2Bans: 0,
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
