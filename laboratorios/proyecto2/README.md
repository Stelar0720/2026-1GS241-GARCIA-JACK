# 🏁 CHECKERS 2.0 - Proyecto con IA A*

Un juego de checkers clásico con sistema de ranking, microservicios y IA A* con heurísticas ajustables.

## 📋 Características

- 🎮 **UI Estilo PEAK** - Tipografía antigua con diseño tipo pergamino
- 🤖 **IA A*** - 3 niveles de dificultad con búsqueda A* y heurística de tablero
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

| Dificultad | Profundidad A* | Enfoque | Descripción |
|------------|----------------|---------|-------------|
| Fácil | 2 | Búsqueda limitada | Para principiantes |
| Medio | 4 | Búsqueda A* intermedia | Desafío equilibrado |
| Difícil | 6 | Búsqueda A* más profunda | IA optimizada al máximo |

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

- **IA A***: Prioriza estados con menor `f = g + h`
- **Estados visitados**: Evita reexplorar tableros con peor costo acumulado
- **Límites de Memoria Docker**: max 512MB por contenedor
- **SQLite WAL Mode**: Mejor concurrencia

## 🧪 Testing

```bash
bun run test
```

## 📝 Licencia

MIT - Proyecto académico
## Tienda de skins y Stripe Checkout

La tienda esta disponible en:

```bash
http://localhost:5173/shop
```

Persistencia local de demo por usuario:

```txt
checkers_owned_skins_<clerkId>
checkers_equipped_skin_<clerkId>
```

Configura Stripe en el archivo `.env` de la raiz:

```env
VITE_STRIPE_PUBLIC_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...

# Opcional: si los dejas como placeholder, el backend usara price_data inline.
STRIPE_PRICE_GOLD=price_REEMPLAZAR_GOLD
STRIPE_PRICE_NEON=price_REEMPLAZAR_NEON
STRIPE_PRICE_MEDIEVAL=price_REEMPLAZAR_MEDIEVAL
STRIPE_PRICE_FIRE_ICE=price_REEMPLAZAR_FIRE_ICE
STRIPE_PRICE_ROYAL=price_REEMPLAZAR_ROYAL
```

Para comprar skins el jugador debe haber iniciado sesion con Clerk. El frontend envia `{ "skinId": "gold", "clerkId": "..." }` al backend. El backend decide el nombre y precio de la skin. Para esta demo universitaria no es obligatorio crear productos ni Price IDs en Stripe Dashboard: si `STRIPE_PRICE_*` esta vacio o como `price_REEMPLAZAR_*`, el backend crea el precio inline con `price_data` por $2.99 USD.

Rutas del flujo:

```txt
/shop
/shop/success?skinId=gold
/shop/cancel
```

Para probar el pago usa tarjetas de prueba de Stripe, por ejemplo `4242 4242 4242 4242`, cualquier fecha futura, cualquier CVC y cualquier codigo postal.
