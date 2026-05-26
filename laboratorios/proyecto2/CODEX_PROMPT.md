# PROMPT PARA CODEX: CREAR PROYECTO CHECKERS CON IA A*

## OBJETIVO
Crear un juego de Checkers clásico con:
- UI estilo antiguo/pergamino (tipografía PEAK)
- IA A* con 3 niveles de dificultad
- Sistema de ranking persistente por movimientos
- Arquitectura de microservicios
- Docker deployment

---

## 1. STACK TECNOLÓGICO (OBLIGATORIO)

| Componente | Tecnología | Versión |
|------------|------------|---------|
| Frontend | HTML + JavaScript vanilla | - |
| Backend API | Hono + Bun | Hono 4.x |
| Database | SQLite (sql.js) | 1.10+ |
| Containerización | Docker Compose | 3.x |

**IMPORTANTE**: No usar frameworks frontend como React/Vue/Angular. El frontend debe ser HTML + CSS + JS vanilla para máxima compatibilidad y rendimiento.

---

## 2. ESTRUCTURA DE CARPETAS

```
checkers-project/
├── apps/
│   ├── api/                         # Backend Hono
│   │   └── src/
│   │       ├── index.ts             # Entry point + routes
│   │       ├── db/
│   │       │   └── schema.ts        # SQLite schema
│   │       └── services/
│   │           ├── game.service.ts  # Lógica del juego
│   │           ├── ai.service.ts    # IA A* + minimax + alpha-beta
│   │           └── ranking.service.ts
│   └── web/                         # Frontend estático
│       ├── dist/
│       │   └── index.html           # App completa
│       └── server.ts               # Bun static server
├── docker/
│   ├── Dockerfile.api
│   ├── Dockerfile.web
│   ├── docker-compose.yml
│   └── nginx.conf
├── packages/
│   └── shared/
│       └── src/
│           └── index.ts             # Tipos TypeScript compartidos
└── package.json
```

---

## 3. TIPOS TYPESCRIPT COMPARTIDOS

Crear en `packages/shared/src/index.ts`:

```typescript
export type Player = 'red' | 'black';
export type GameStatus = 'waiting' | 'playing' | 'won' | 'draw';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type GameMode = 'pvp' | 'pva';

export interface Position { row: number; col: number; }

export interface Piece {
  player: Player;
  isKing: boolean;
  id: string;
}

export type Board = (Piece | null)[][];

export interface Move {
  from: Position;
  to: Position;
  isJump: boolean;
  capturedPieces?: Position[];
}

export interface GameState {
  id: string;
  board: Board;
  currentPlayer: Player;
  moveCount: number;
  capturedPieces: { red: number; black: number };
  status: GameStatus;
  difficulty?: Difficulty;
  gameMode: GameMode;
  winner?: Player;
}

export interface AIConfig {
  difficulty: Difficulty;
  maxDepth: number;
  useAlphaBeta: boolean;
  weights: AIWeights;
}

export interface AIWeights {
  pieceValue: number;
  kingValue: number;
  centerControl: number;
  advancementBonus: number;
  jumpOpportunity: number;
}

export const BOARD_SIZE = 8;
```

---

## 4. API BACKEND (Hono + Bun)

### 4.1 Endpoints Requeridos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/health` | Health check del sistema |
| `GET` | `/health/all` | Estado de todos los microservicios |
| `POST` | `/game/init` | Iniciar nueva partida |
| `GET` | `/game/state/:id` | Obtener estado del juego |
| `POST` | `/game/move` | Realizar un movimiento |
| `POST` | `/ai/move` | Calcular movimiento de IA |
| `GET` | `/ai/difficulty` | Ver niveles de dificultad |
| `POST` | `/ranking` | Guardar puntuación |
| `GET` | `/ranking/top` | Top 10 de rankings |
| `GET` | `/ranking/user/:username` | Rankings por usuario |
| `GET` | `/kernel/stats` | Estadísticas del sistema |
| `GET` | `/os/uptime` | Uptime del servidor |

### 4.2 Schema SQLite

Usar sql.js (sin native dependencies):

```typescript
// Tablas necesarias:
// rankings(id, username, moves, difficulty, game_mode, created_at, device_hash, clerk_id)
// game_sessions(id, board, current_player, move_count, status, difficulty, game_mode, winner, created_at)
// heartbeats(id, service_name, status, timestamp, metadata)
```

### 4.3 CORS Configuration

```typescript
import { cors } from 'hono/cors';

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'x-clerk-id']
}));
```

---

## 5. LÓGICA DEL JUEGO (game.service.ts)

### 5.1 Funciones Requeridas

```typescript
function createInitialBoard(): Board;     // Tablero 8x8 con 12 fichas cada jugador
function createGameState(difficulty?: Difficulty, gameMode: GameMode): GameState;
function getLegalMoves(board: Board, player: Player): Move[];  // Incluye saltos
function getSimpleMoves(board: Board, player: Player): Move[];
function getJumpMoves(board: Board, player: Player): Move[];
function applyMove(board: Board, move: Move, player: Player): Board;
function checkGameOver(board: Board, currentPlayer: Player): { isOver: boolean; winner?: Player; status: GameStatus };
```

### 5.2 Reglas del Juego

1. Tablero 8x8, fichas solo en casillas oscuras
2. Negras (black) mueven primero
3. Movimiento diagonal hacia adelante
4. Captura obligatoria si hay salto disponible
5. Coronación cuando llega al extremo opuesto
6. Reyes pueden moverse en ambas direcciones
7. Victoria por captura total o bloqueo de movimientos

---

## 6. IA A* (ai.service.ts)

### 6.1 Configuraciones por Dificultad

| Dificultad | maxDepth | Alpha-Beta | Descripción |
|------------|----------|------------|-------------|
| easy | 2 | No | Principiante |
| medium | 4 | Sí | Intermedio |
| hard | 6 | Sí | Experto |

### 6.2 Algoritmo Minimax + Alpha-Beta Pruning

```typescript
function minimax(board, depth, useAlphaBeta, alpha, beta, isMaximizing, aiPlayer, config): { score: number; move: Move };

function evaluateBoard(board, player, config): number {
  // Heurística:
  // - Pieza normal: +10 / -10
  // - Rey: +25 / -25
  // - Control del centro: +7
  // - Avance hacia coronación: +3 por fila
  // - Oportunidad de captura: +20
}
```

### 6.3 Función Principal

```typescript
function calculateBestMove(board: Board, difficulty: Difficulty): Move | null;
```

---

## 7. FRONTEND (HTML + CSS + JS)

### 7.1 Diseño - Estilo PEAK/Pergamino

```css
/* Tipografía estilo antiguo */
.peak-title {
  font-family: 'VT323', monospace;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #5c4a32;
}

.peak-text {
  font-family: 'VT323', monospace;
  letter-spacing: 0.05em;
  text-shadow: 1px 1px 0 rgba(0,0,0,0.3);
}

/* Fondo pergamino */
.peak-paper {
  background: linear-gradient(135deg, #f5f5dc 0%, #efe9d5 25%, #f5f5dc 50%, #efe9d5 75%, #f5f5dc 100%);
  border: 3px solid #8b7355;
  box-shadow: inset 0 0 20px rgba(139, 115, 85, 0.2), 4px 4px 0 rgba(0,0,0,0.15);
}

/* Botón estilo antiguo */
.peak-button {
  font-family: 'VT323', monospace;
  background: linear-gradient(180deg, #d4c4a8 0%, #c4b498 100%);
  border: 2px solid #8b7355;
  padding: 10px 20px;
}
```

### 7.2 Tablero de Juego

```css
.game-board {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  aspect-ratio: 1;
  max-width: 480px;
  border: 4px solid #2c1810;
}

.cell-dark {
  background: linear-gradient(135deg, #8b4513 0%, #654321 100%);
}

.cell-light {
  background: linear-gradient(135deg, #deb887 0%, #d2b48c 100%);
}

.piece-red {
  background: linear-gradient(135deg, #dc143c 0%, #8b0000 100%);
  border: 3px solid #4a0000;
}

.piece-black {
  background: linear-gradient(135deg, #696969 0%, #2f2f2f 100%);
  border: 3px solid #1a1a1a;
}
```

### 7.3 Página de Tutorial (Modal)

Estilo pergamino antigo con:
1. Movimiento - fichas en diagonal hacia adelante
2. Captura - saltar sobre enemigo (obligatoria si disponible)
3. Coronación - llega al extremo y se convierte en Rey
4. Victoria - capturar todas o bloquear al rival
5. Puntuación - menos movimientos = mejor ranking

Con opción "No mostrar de nuevo" (localStorage).

### 7.4 Selector de Dificultad

Botones visuales con iconos:
- Fácil 🌱 - "2 movimientos de profundidad"
- Medio ⚔️ - "Alpha-Beta pruning"
- Difícil 🔥 - "6 movimientos de profundidad"

### 7.5 Tabla de Ranking

- Columnas: Posición, Jugador, Movimientos, Dificultad, Fecha
- Medallas 🥇🥈🥉 para top 3
- Badges de colores según dificultad
- Ordenado por MENOS movimientos primero

---

## 8. FLUJO DE JUEGO

```
1. Usuario abre app → Home
2. Click "Nueva Partida" → Setup
3. Ingresa nombre
4. Selecciona dificultad
5. Tutorial modal (si no ha saltado)
6. Iniciar juego → API /game/init
7. Tablero de juego
8. Jugador selecciona ficha → muestra movimientos válidos
9. Jugador hace clic en destino → API /game/move
10. IA calcula respuesta → API /game/move (turno IA automático)
11. Repetir hasta game over
12. Guardar ranking → API /ranking
13. Mostrar resultado
14. Opción: Jugar de nuevo o Volver al inicio
```

---

## 9. API CLIENT EN FRONTEND

```javascript
const API = 'http://localhost:3001';

async function initGame(difficulty, username) {
  const res = await fetch(`${API}/game/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ difficulty, gameMode: 'pva', username })
  });
  return res.json();
}

async function makeMove(gameId, move, username) {
  const res = await fetch(`${API}/game/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameId, move, username })
  });
  return res.json();
}

async function getRankings() {
  const res = await fetch(`${API}/ranking/top?limit=20`);
  return res.json();
}
```

---

### 10. DOCKER CONFIGURATION

#### 10.1 docker-compose.yml

```yaml
services:
  api:
    build: ./apps/api
    ports: ["3001:3001"]
    volumes: ["sqlite-data:/app/data"]
    deploy:
      resources:
        limits: { memory: 512M }

  web:
    build: ./apps/web
    ports: ["80:3000"]
    depends_on: [api]

volumes:
  sqlite-data:
```

#### 10.2 Dockerfile.api

```dockerfile
FROM oven/bun:1-alpine
WORKDIR /app
COPY package.json bun.lockb ./
COPY apps/api ./apps/api
RUN bun install --frozen-lockfile
EXPOSE 3001
CMD ["bun", "run", "apps/api/src/index.ts"]
```

#### 10.3 nginx.conf (SPA routing)

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

---

## 11. OPTIMIZACIONES IMPORTANTES

1. **sql.js en vez de better-sqlite3**: Evita native dependencies que fallan en algunos sistemas
2. **Alpha-Beta Pruning**: Reduce espacio de búsqueda de la IA drásticamente
3. **Límites de memoria Docker**: max 512MB por servicio
4. **Memoización en IA**: Evitar recálculo de estados ya evaluados
5. **Frontendif sin frameworks**: Carga instantánea, bajo consumo de memoria

---

## 12. REQUISITOS FINAL ES

- [x] Tablero 8x8 funcional
- [x] Movimiento de fichas
- [x] Capturas obligatorias
- [x] Coronación de reyes
- [x] IA A* con 3 dificultades
- [x] Ranking persistente (menor movimientos = mejor)
- [x] Tutorial con opción de saltar
- [x] UI estilo antiguo PEAK
- [x] Docker deployment
- [x] Microservicios (Game, AI, Ranking, Heartbeat, Kernel)
- [x] OPTIMIZADO para no matar la computadora

---

## INSTRUCCIONES PARA CODEX

1. Crear estructura de carpetas según sección 2
2. Implementar tipos compartida (sección 3)
3. Crear API backend con Hono (sección 4)
4. Implementar lógica del juego (sección 5)
5. Implementar IA A* con minimax (sección 6)
6. Crear frontend HTML/CSS/JS (sección 7)
7. Configurar Docker (sección 10)
8. Probar que funcione sin errores
9. Verificar que ranking se persiste en SQLite
