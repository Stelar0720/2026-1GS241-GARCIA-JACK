// Sinnoh Edition - WebSocket Client for Frontend

export type MessageType = 
  | 'register'
  | 'create_room'
  | 'join_room'
  | 'leave_room'
  | 'ready'
  | 'ban_pokemon'
  | 'select_team'
  | 'call_coin'
  | 'battle_action'
  | 'switch_pokemon'
  | 'ping'
  | 'registered'
  | 'room_created'
  | 'room_joined'
  | 'opponent_joined'
  | 'opponent_left'
  | 'player_ready'
  | 'phase_change'
  | 'pokemon_banned'
  | 'team_selected'
  | 'coin_flip_result'
  | 'battle_update'
  | 'error'
  | 'pong'
  | 'ban_timer'
  | 'ban_timer_update'
  | 'ban_skipped'
  | 'ban_turn_changed';

export interface WSMessage {
  type: MessageType;
  payload: any;
}

export interface WSConfig {
  url: string;
  reconnectInterval?: number;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onMessage?: (message: WSMessage) => void;
  onError?: (error: Event) => void;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private config: WSConfig;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private shouldReconnect = true;
  private messageQueue: WSMessage[] = [];

  constructor(config: WSConfig) {
    this.config = {
      reconnectInterval: 3000,
      ...config,
    };
  }

  connect() {
    try {
      this.ws = new WebSocket(this.config.url);
      
      this.ws.onopen = () => {
        console.log('🔌 WebSocket connected');
        this.reconnectAttempts = 0;
        this.flushMessageQueue();
        this.config.onConnect?.();
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          this.config.onMessage?.(message);
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      this.ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        this.config.onDisconnect?.();
        
        if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(`🔄 Reconnecting... attempt ${this.reconnectAttempts}`);
          setTimeout(() => this.connect(), this.config.reconnectInterval);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.config.onError?.(error);
      };
    } catch (e) {
      console.error('Failed to create WebSocket:', e);
    }
  }

  send(message: WSMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Queue message for later
      this.messageQueue.push(message);
    }
  }

  private flushMessageQueue() {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift();
      if (message) {
        this.ws.send(JSON.stringify(message));
      }
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    this.ws?.close();
    this.ws = null;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
let wsClient: WebSocketClient | null = null;

export function initWebSocket(
  _playerId: string,
  handlers: {
    onConnect?: () => void;
    onDisconnect?: () => void;
    onMessage?: (message: WSMessage) => void;
    onError?: (error: Event) => void;
  }
): WebSocketClient {
  if (wsClient) {
    wsClient.disconnect();
  }

  wsClient = new WebSocketClient({
    url: 'ws://localhost:3001',
    onConnect: handlers.onConnect,
    onDisconnect: handlers.onDisconnect,
    onMessage: handlers.onMessage,
    onError: handlers.onError,
  });

  wsClient.connect();
  return wsClient;
}

export function getWebSocket(): WebSocketClient | null {
  return wsClient;
}

export function sendWSMessage(type: MessageType, payload: any) {
  wsClient?.send({ type, payload });
}

// Helper functions for common actions
export const wsActions = {
  register: (playerId: string, name: string, gender: string, spriteUrl: string) => {
    sendWSMessage('register', { playerId, name, gender, spriteUrl });
  },

  createRoom: (playerId: string) => {
    sendWSMessage('create_room', { playerId });
  },

  joinRoom: (playerId: string, code: string) => {
    sendWSMessage('join_room', { playerId, code });
  },

  leaveRoom: (playerId: string) => {
    sendWSMessage('leave_room', { playerId });
  },

  ready: (playerId: string) => {
    sendWSMessage('ready', { playerId });
  },

  banPokemon: (playerId: string, pokemonId: string) => {
    sendWSMessage('ban_pokemon', { playerId, pokemonId });
  },

  selectTeam: (playerId: string, team: any[]) => {
    sendWSMessage('select_team', { playerId, team });
  },

  callCoin: (playerId: string, side: 'red' | 'charizard') => {
    sendWSMessage('call_coin', { playerId, side });
  },

  battleAction: (playerId: string, action: string, data: any) => {
    sendWSMessage('battle_action', { playerId, action, data });
  },

  switchPokemon: (playerId: string, pokemonId: number) => {
    sendWSMessage('switch_pokemon', { playerId, pokemonId });
  },
};
