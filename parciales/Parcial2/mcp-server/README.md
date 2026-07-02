# UrbanSprout MCP Server

Servidor MCP (Model Context Protocol) que expone operaciones de UrbanSprout a agentes de IA (Claude Code, Codex). Primer avance: esqueleto + 2 tools de solo lectura sobre el `bun-api` existente.

## Tools disponibles

| Tool | HU | Auth | Qué hace |
|---|---|---|---|
| `search_products` | HU-053 | Público | Busca productos por texto, rango de precio y etiqueta, paginado de a 12 |
| `get_business_metrics` | HU-036 | `adminKey` (debe matchear `MCP_ADMIN_KEY`) | Revenue total, órdenes por estado y ticket promedio (AOV) |

`get_business_metrics` es una versión simplificada de autorización: el llamador pasa `adminKey` como parámetro de la tool, que se compara contra la variable de entorno `MCP_ADMIN_KEY` del proceso. No es el flujo completo de Clerk JWT que describe HU-025 — eso queda para un próximo avance.

## Cómo correrlo

Requiere el `bun-api` corriendo (por defecto en `http://localhost:4000`).

```bash
cd mcp-server
bun install
API_URL=http://localhost:4000 MCP_ADMIN_KEY=tu-clave-admin bun run start
```

## Cómo conectarlo desde Claude Code

Agregar a la config de MCP servers (`.mcp.json` o equivalente):

```json
{
  "mcpServers": {
    "urbansprout": {
      "command": "bun",
      "args": ["run", "start"],
      "cwd": "mcp-server",
      "env": {
        "API_URL": "http://localhost:4000",
        "MCP_ADMIN_KEY": "tu-clave-admin"
      }
    }
  }
}
```
