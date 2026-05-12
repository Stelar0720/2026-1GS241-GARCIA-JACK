# Sinnoh Edition: Pokemon World Championships

Un juego de batalla Pokemon multiplayer local desarrollado como proyecto universitario con fines educativos.

![Sinnoh Edition Banner](https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/387.png)

## Caracteristicas

- Sistema multiplayer con WebSocket
- Seleccion de campeon y genero
- Sistema de salas con codigos de 6 caracteres
- Fase de bans (3 por jugador)
- Seleccion de equipo con timer de 60 segundos
- Combate por turnos con efectos de estado
- Trofeos por generacion (especial para Sinnoh/Gen 4)
- Animacion de moneda para determinar primero
- Estetica Nintendo DS / Pokemon Platino
- Cache de datos de PokéAPI

## Requisitos

- [Bun](https://bun.sh/) v1.0 o superior
- Node.js no requerido (Bun lo incluye)
- Git (opcional)

## Instalacion

```bash
# Clonar o navegar al directorio del proyecto
cd proyecto1

# Instalar dependencias
bun install
```

## Ejecucion

### Ejecutar ambos servidores (desarrollo)

```bash
# En una terminal para el API
bun run api

# En otra terminal para el frontend web
bun run web
```

### Comandos individuales

```bash
# Solo API (puerto 3000)
bun run api

# Solo Web (puerto 5173)
bun run web

# Compilar frontend
bun run build
```

## Estructura del Proyecto

```
proyecto1/
├── apps/
│   ├── web/                    # Frontend (Preact + Vite)
│   │   ├── src/
│   │   │   ├── features/       # ChampionSelect, Lobby, Battle, etc.
│   │   │   ├── lib/             # API client y WebSocket
│   │   │   └── styles/          # Estilos CSS
│   │   └── package.json
│   │
│   └── api/                    # Backend (Hono + Bun)
│       ├── src/
│       │   ├── routes/          # Endpoints API
│       │   ├── services/        # Logica de negocio
│       │   ├── database/        # Schema SQLite
│       │   └── index.ts         # Entry point
│       └── package.json
│
├── packages/
│   ├── shared/                 # Tipos y constantes
│   ├── battle-engine/          # Logica de combate
│   └── pokemon-cache/          # Utilidades de Pokemon
│
├── docs/                       # Documentacion
└── package.json                 # Root package
```

## Multiplayer Local

### Misma PC

1. Abre el navegador principal en `http://localhost:5173`
2. Abre otra ventana en modo incognito `http://localhost:5173`
3. Crea una sala en una y unete con el codigo en la otra

### Diferentes PCs en la misma red

1. Averigua la IP local de la PC que ejecuta el servidor:
   ```powershell
   ipconfig
   # Busca IPv4 en adaptador de red
   ```

2. Desde la otra PC, accede a:
   ```
   http://[IP-LOCAL]:5173
   ```

3. Para el WebSocket, usa la misma IP:
   ```typescript
   ws://[IP-LOCAL]:3001
   ```

### Configurar para red local

Si necesitas acceder desde otros dispositivos, inicia web con host:

```bash
cd apps/web
bun run dev --host
```

## API Endpoints

### HTTP

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/health` | Health check del servidor |
| GET | `/api/pokemon/:id` | Obtener Pokemon por ID |
| GET | `/api/pokemon/search/:name` | Buscar Pokemon por nombre |
| GET | `/api/pokemon/generation/:gen` | Pokemon de una generacion |
| GET | `/api/pokemon/:id/moves` | Movimientos de un Pokemon |
| GET | `/api/cache/status` | Estadisticas del cache |
| POST | `/api/cache/clear` | Limpiar cache |

### WebSocket (puerto 3001)

```typescript
// Mensajes cliente -> servidor
register, create_room, join_room, ready, 
ban_pokemon, select_team, battle_action, switch_pokemon

// Mensajes servidor -> cliente
registered, room_created, room_joined, opponent_joined,
player_ready, phase_change, pokemon_banned, team_selected,
battle_update, error
```

## Configuracion

### Constantes del Juego

Edita `packages/shared/src/constants.ts`:

```typescript
export const GAME_CONFIG = {
  TESTING_GOD_MODE: false,      // Modo dios para testing
  MAX_POKEMON_PER_TEAM: 6,       // Maximo Pokemon por equipo
  MIN_POKEMON_PER_TEAM: 1,      // Minimo Pokemon por equipo
  BAN_LIMIT_PER_PLAYER: 3,       // Bans maximos por jugador
  TEAM_SELECTION_TIMEOUT: 60,    // Segundos para seleccionar equipo
  RANDOM_FILL_ENABLED: true,     // Permitir relleno aleatorio
};
```

### Puerto del Servidor

- API HTTP: 3000 (configurable en `apps/api/src/index.ts`)
- WebSocket: 3001 (configurable en el mismo archivo)
- Web Dev Server: 5173

## Desarrollo

### Estructura de Commits Recomendados

```
feat: agregar nueva funcionalidad
fix: correccion de bug
docs: cambios en documentacion
style: formateo de codigo
refactor: refactorizacion
test: agregar tests
```

### Agregar nueva feature

1. Crea la carpeta en `apps/web/src/features/[Nombre]`
2. Implementa el componente React
3. Agrega rutas en `App.tsx`
4. Actualiza tipos en `packages/shared`

## Tecnologias

- **Frontend:** Preact, Vite, TypeScript
- **Backend:** Hono, Bun, WebSocket, SQLite
- **API de Datos:** PokéAPI
- **Estilos:** CSS con pixel art

## Disclaimer

**Proyecto universitario desarrollado únicamente con fines educativos y académicos. No está afiliado, asociado, autorizado ni patrocinado por Nintendo, Game Freak, The Pokémon Company ni sus marcas relacionadas.**

## Licencia

Este proyecto es solo para uso educativo. Verifica con tu universidad/instructor los terminos de uso.

## Autores

Desarrollado como parte del curso DSIX.

## Recursos

- [PokéAPI](https://pokeapi.co/) - API de datos Pokemon
- [Bun](https://bun.sh/) - Runtime JavaScript
- [Hono](https://hono.dev/) - Framework web ligero
- [Preact](https://preactjs.com/) - alternativa React 3KB
