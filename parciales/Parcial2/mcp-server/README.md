# UrbanSprout MCP Server

Servidor MCP (Model Context Protocol) que expone operaciones de UrbanSprout a agentes de IA (Claude Code, Codex), **bajo autenticación por rol**. Transporte stdio.

## Autenticación por rol

El servidor se lanza con una API key (`MCP_API_KEY`) que lo identifica ante el `bun-api`. Al arrancar consulta `GET /auth/whoami` para resolver su **rol** y **permisos**. Las operaciones personales, como la wishlist, usan por separado `MCP_USER_TOKEN`, un JWT de sesión de Clerk, para que el backend derive el usuario autenticado.

| Rol | Key (env) | Permisos |
|---|---|---|
| `public` | (sin key) | solo `search_products` |
| `client` | `MCP_CLIENT_KEY` | `orders:cancel` + búsqueda |
| `support` | `MCP_SUPPORT_KEY` | `catalog:read`, `orders:read`, `auth:read` |
| `admin` | `MCP_ADMIN_KEY` | todos |
| `ci` | `MCP_CI_KEY` | ejecución de suites QA |

Las keys las define el `bun-api` por variables de entorno (`MCP_ADMIN_KEY`, `MCP_SUPPORT_KEY`, `MCP_CLIENT_KEY`). El servidor MCP se lanza con **una** de esas keys en `MCP_API_KEY`.

## Tools

| Tool | HU | Permiso | Qué hace |
|---|---|---|---|
| `search_products` | HU-053 | público | Busca/filtra productos, paginado |
| `get_role_permissions` | HU-050 | `auth:read` | Matriz de roles y permisos |
| `authorize_user` | HU-025 | `auth:read` | Valida si un rol tiene un permiso |
| `get_business_metrics` | HU-036 | `metrics:read` | Revenue, órdenes por estado, AOV |
| `manage_catalog` | HU-068 | `catalog:read`/`write` | List / create / update / set-stock |
| `cancel_order` | HU-066 | `orders:cancel` | Cancela orden pendiente (con guard) |
| `sync_orders_stripe` | HU-031 | `orders:sync` | Reconcilia órdenes con Stripe |
| `export_data` | HU-064 | `export:read` | Exporta órdenes/productos/inventario CSV/JSON |
| `generate_sales_report` | HU-067 | `reports:read` | Reporte de ventas por período |
| `query_audit_logs` | HU-029 | `audit:read` | Consulta el log de auditoría |
| `manage_users` | HU-051 | `users:manage` | Busca, invita, cambia roles y suspende usuarios administrativos |
| `run_unit_tests` | HU-042 | `qa:run` | Ejecuta tests unitarios puros con cobertura |
| `run_integration_tests` | HU-043 | `qa:run` | Ejecuta integración E2E con MongoDB aislada |
| `run_accessibility_audit` | HU-061 | `qa:run` | Ejecuta aXe WCAG 2.1 AA |
| `manage_wishlist` | HU-058 | JWT Clerk (`MCP_USER_TOKEN`) | Lista, agrega o elimina productos de la wishlist del cliente |
| `manage_api_keys` | HU-027 | admin | Crea, lista, rota y revoca API keys hash-only |
| `manage_backups` | HU-063 | admin | Crea, lista y restaura snapshots MongoDB confirmados |

## Correrlo

Requiere el `bun-api` corriendo con las keys configuradas:

```bash
# bun-api
cd bun-api
MCP_ADMIN_KEY=... MCP_SUPPORT_KEY=... MCP_CLIENT_KEY=... bun run src/index.ts

# mcp-server
cd mcp-server
bun install
API_URL=http://localhost:4000 MCP_API_KEY=<tu-key> bun run start
```

## Importar desde Claude Code / Codex

Agregar a la config de MCP servers (`.mcp.json`):

```json
{
  "mcpServers": {
    "urbansprout": {
      "command": "bun",
      "args": ["run", "start"],
      "cwd": "mcp-server",
      "env": {
        "API_URL": "http://localhost:4000",
        "MCP_API_KEY": "<tu-key-segun-rol>",
        "MCP_USER_TOKEN": "<jwt-clerk-del-cliente>"
      }
    }
  }
}
```

Cambiando `MCP_API_KEY` cambia el rol y, por lo tanto, qué tools quedan habilitadas.

`MCP_USER_TOKEN` es opcional para el resto de tools y obligatorio para `manage_wishlist`. Debe ser un token corto de sesión, no `CLERK_SECRET_KEY`. La tool no recibe `userId`: la API obtiene al usuario del claim `sub` del JWT.
