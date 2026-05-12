# Sinnoh Edition: Pokémon World Championships

> *Proyecto universitario desarrollado únicamente con fines educativos y académicos. No está afiliado, asociado, autorizado ni patrocinado por Nintendo, Game Freak, The Pokémon Company ni sus marcas relacionadas.*

---

## 🚀 Inicio Rápido

### Requisitos
- Bun >= 1.0

### Instalación
```bash
bun install
```

### Ejecutar el Proyecto
```bash
# Terminal 1: API Backend
bun run api

# Terminal 2: Web Frontend
bun run web
```

### URLs
- **Web**: http://localhost:5173
- **API**: http://localhost:3000

---

## 📁 Estructura del Proyecto

```
sinnoh-edition-pwc/
├── apps/
│   ├── web/              # Frontend React + Preact
│   └── api/             # Backend Hono
├── packages/
│   ├── shared/          # Tipos y constantes compartidas
│   ├── battle-engine/   # Motor de batalla
│   └── pokemon-cache/   # Gestión de caché PokéAPI
├── docs/
├── package.json         # Monorepo raíz
└── readme.md
```

---

## 🎮 Flujo de Pantallas

1. **Champion Select** → Selección de nombre y género
2. **Lobby** → Crear o unirse a sala
3. **Ban Phase** → Banear 3 Pokémon por jugador
4. **Team Select** → Seleccionar 1-6 Pokémon
5. **Battle** → Batalla por turnos
6. **Results** → Pantalla de resultados

---

## ⚙️ Configuración

### Variables de Entorno
```env
# API
PORT=3000

# PokéAPI (no requiere API key)
POKEAPI_BASE=https://pokeapi.co/api/v2
```

### Configuración de Juego
Ver `packages/shared/src/constants.ts`:
- `MAX_POKEMON_PER_TEAM`: 6
- `MIN_POKEMON_PER_TEAM`: 1
- `BAN_LIMIT_PER_PLAYER`: 3
- `TEAM_SELECTION_TIMEOUT`: 60s
- `TESTING_GOD_MODE`: false

---

## 🛠️ Stack Tecnológico

| Componente | Tecnología |
|------------|------------|
| Frontend | React + Preact + Vite |
| Backend | Hono + Bun |
| Tiempo Real | Firebase (placeholder) |
| Datos | PokéAPI con caché local |
| Tipado | TypeScript |
| Estilo | CSS Pixel Art DS |

---

## 📝 Comandos Disponibles

```bash
bun run api      # Iniciar API en puerto 3000
bun run web      # Iniciar frontend en puerto 5173
bun run build    # Build de producción
```

---

## 🔧 Desarrollo Futuro

- [ ] Implementar Firebase Realtime Database
- [ ] Agregar animaciones de ataques
- [ ] Sistema de sonidos
- [ ] Coin flip animado
- [ ] Más funcionalidades de battle system

---

*Creado: 2026-05-12 | I Semestre 2026 / DSIX*