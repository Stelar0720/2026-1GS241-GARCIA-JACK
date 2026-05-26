# 🏁 CHECKERS 2.0 - Proyecto con IA A*

Un juego de checkers clásico con sistema de ranking, microservicios y IA A* con heurísticas ajustables.

## 📋 Características

- 🎮 **UI Estilo PEAK** - Tipografía antigua con diseño tipo pergamino
- 🤖 **IA A*** - 3 niveles de dificultad con algoritmo Minimax + Alpha-Beta pruning
- 🏆 **Sistema de Ranking** - Persistido en SQLite, orden por menos movimientos
- ⚙️ **Arquitectura Microservicios** - Game, AI, Ranking, Heartbeat, Kernel
- 📦 **Docker Ready** - Desplegable con docker-compose

## 🛠️ Stack Tecnológico

| Componente | Tecnología |
|------------|------------|
| Frontend | TanStack Start + React + TypeScript |
| Backend API | Hono + Bun |
| Database | SQLite + Drizzle ORM |
| Containerización | Docker + Docker Compose |

## 📁 Estructura del Proyecto

```
checkers-project/
├── apps/
│   ├── api/                    # Backend Hono (Microservicios)
│   │   └── src/
│   │       ├── db/             # Schema SQLite
│   │       ├── services/       # Game, AI, Ranking services
│   │       ├── routes/         # Endpoints API
│   │       ├── tests/          # Tests unitarios
│   │       └── index.ts        # Entry point
│   │
│   └── web/                    # Frontend TanStack Start
│       └── src/
│           ├── components/      # Board, Piece, Tutorial, etc.
│           ├── routes/         # Páginas
│           ├── lib/            # API client, utils, styles
│           └── app.tsx         # App principal
│
├── packages/
│   └── shared/                 # Tipos compartidos
│
├── docker/                     # Docker files
│   ├── Dockerfile.api
│   ├── Dockerfile.web
│   ├── docker-compose.yml
│   └── nginx.conf
│
├── package.json                # Monorepo root
└── README.md
```

## 🚀 Inicio Rápido

### Requisitos
- Bun 1.0+
- Docker + Docker Compose

### Desarrollo Local

```bash
# 1. Instalar dependencias
bun install

# 2. Iniciar API (terminal 1)
bun run dev:api

# 3. Iniciar Frontend (terminal 2)
bun run dev:web

# Abrir en el navegador
# Frontend: http://localhost:5173
# API: http://localhost:3001
```

### Docker

```bash
# Construir y levantar
docker compose -f docker/docker-compose.yml up --build

# Acceder a:
# - Frontend: http://localhost:80
# - API: http://localhost:3001
```

## 🎯 Dificultades IA

| Dificultad | Profundidad | Alpha-Beta | Descripción |
|------------|-------------|-----------|-------------|
| Fácil | 2 | No | Para principiantes |
| Medio | 4 | Sí | Desafío equilibrado |
| Difícil | 6 | Sí | IA optimizada al máximo |

## 📊 Sistema de Ranking

El ranking se ordena por **menos movimientos** para ganar:
- Menos movimientos = Mejor posición
- Se filtra por dificultad
- Persistente en volumen Docker

## 🔧 API Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/health` | Health check general |
| `GET` | `/health/all` | Estado de todos los servicios |
| `POST` | `/game/init` | Iniciar nueva partida |
| `GET` | `/game/state/:id` | Obtener estado del juego |
| `POST` | `/game/move` | Realizar movimiento |
| `POST` | `/ai/move` | Calcular movimiento IA |
| `GET` | `/ai/difficulty` | Niveles de dificultad |
| `POST` | `/ranking` | Guardar resultado |
| `GET` | `/ranking/top` | Top 10 rankings |

## 📜 Tutorial (Estilo PEAK)

El juego incluye un modal-tutorial con:
- Reglas del juego
- Tipografía estilo antiguo
- Opción para saltar (se guarda preference)

## ⚠️ Optimizaciones

- **AI con Memoización**: Evita recálculo de estados
- **Alpha-Beta Pruning**: Reduce espacio de búsqueda
- **Límites de Memoria Docker**: max 512MB por contenedor
- **SQLite WAL Mode**: Mejor concurrencia

## 🧪 Testing

```bash
bun run test
```

## 📝 Licencia

MIT - Proyecto académico
