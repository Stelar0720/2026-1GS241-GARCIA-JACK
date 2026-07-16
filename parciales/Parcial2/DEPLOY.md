# Despliegue remoto — Railway + MongoDB Atlas

Validado el **14 de julio de 2026**.

## URLs de producción

- Storefront: https://urbansprout-storefront-production.up.railway.app
- Backoffice: https://urbansprout-backoffice-production.up.railway.app
- API Bun/Hono: https://urbansprout-api-production.up.railway.app
- Health: https://urbansprout-api-production.up.railway.app/health
- GitHub Project: https://github.com/users/Stelar0720/projects/2

## URLs de staging

- Storefront: https://urbansprout-storefront-staging.up.railway.app
- Backoffice: https://urbansprout-backoffice-staging.up.railway.app
- API health: https://urbansprout-api-staging.up.railway.app/health

`main` despliega automáticamente a staging únicamente después de que `UrbanSprout CI` termina correctamente. Railway espera los check suites requeridos antes de construir.

Producción sigue la rama `production`. Para promover una versión, se ejecuta manualmente `UrbanSprout CD` desde GitHub Actions, se escribe `DEPLOY` y el propietario debe aprobar el environment protegido `production`. El workflow promueve el mismo commit probado, ejecuta smoke tests y crea un GitHub Release con tag y changelog automáticos.

## Arquitectura desplegada

- Storefront: React 19 + Vite en Railway.
- Backoffice: React 19 + Vite en Railway.
- API: Bun + Hono en Railway, con autodeploy desde `main`.
- Base de datos: MongoDB Atlas M0 (replica set y persistencia remota).
- MCP: servidor `stdio` importable en Claude Code/Codex; consume la API pública y reenvía una key por rol.

Root Directory del API:

```text
/parciales/Parcial2/bun-api
```

## Variables principales

API:

```text
MONGODB_URI=mongodb+srv://...
MONGODB_DATABASE=urbansprout
APP_URL=https://urbansprout-storefront-production.up.railway.app
ALLOWED_ORIGINS=https://urbansprout-storefront-production.up.railway.app,https://urbansprout-backoffice-production.up.railway.app
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
MCP_ADMIN_KEY=...
MCP_SUPPORT_KEY=...
MCP_CLIENT_KEY=...
```

Frontends:

```text
VITE_API_URL=https://urbansprout-api-production.up.railway.app
VITE_CLERK_PUBLISHABLE_KEY=...
VITE_ADMIN_EMAILS=...
```

## Importar el MCP

```json
{
  "mcpServers": {
    "urbansprout": {
      "command": "bun",
      "args": ["run", "start"],
      "cwd": "parciales/Parcial2/mcp-server",
      "env": {
        "API_URL": "https://urbansprout-api-production.up.railway.app",
        "MCP_API_KEY": "<MCP_ADMIN_KEY, MCP_SUPPORT_KEY o MCP_CLIENT_KEY>"
      }
    }
  }
}
```

Validación MCP: 10 tools descubiertas, rol `admin` con 10 permisos y llamadas `search_products`/`get_role_permissions` exitosas.

## Evidencia de smoke test

- Storefront, backoffice, `/health` y `/products`: HTTP 200.
- Reinicio de API: 3 productos conservaron ID, fecha y stock.
- Transacción Atlas + Stripe test: reserva `18 → 17`, orden `pending`, cancelación, orden `cancelled`, stock `17 → 18`.
- Playwright: 26/26.
- Repositorio Mongo: 8/8 pruebas y 32 assertions.
- GitHub Actions: lint, builds y E2E en verde.

## Redeploy y logs

Los pushes a `main` despliegan automáticamente la API.

```powershell
railway service status --service urbansprout-api --json
railway logs --service urbansprout-api --lines 100
```
