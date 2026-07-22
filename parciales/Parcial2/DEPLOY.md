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

## Si un despliegue "pasa" pero no cambia nada

Síntoma: el CD da verde, `/health` responde 200, pero las rutas nuevas devuelven
404 y las viejas 401. Eso es una versión anterior corriendo.

Orden para diagnosticarlo:

1. `curl <api>/version` — si el `commit` no es el de la rama, no desplegó. Punto.
2. Mirá la salida del step `Deploy all services to Railway staging`. Si el
   `railway up` no imprimió *nada* (ni "Indexing", ni "Uploading", ni una URL de
   build), el CLI no hizo el trabajo aunque haya salido con código 0.
3. Revisá la versión del CLI que se instaló. Está pinneada en el workflow
   justamente porque un release de Railway rompió el despliegue en silencio.
4. Recién ahí, el dashboard de Railway → servicio → Deployments → log de build.

## Cómo saber qué versión está corriendo

```bash
curl https://urbansprout-api-production.up.railway.app/version
# {"commit":"70ee1d4...","short":"70ee1d4","environment":"production","startedAt":"..."}
```

Compara ese `commit` contra el de la rama. Si no coinciden, **el despliegue no llegó**, por más que `/health` responda 200.

El paso de verificación del CD (`.github/scripts/verify-deploy.sh`) hace exactamente esa comparación y falla si no coincide. Antes solo hacía `curl /health`, que la instancia anterior también contesta: el pipeline daba verde sin haber desplegado nada.

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

La configuración esperada está documentada por ambiente en
`.env.development.example`, `.env.staging.example` y `.env.production.example`.
Estas plantillas no contienen credenciales: Railway y GitHub Actions inyectan
los valores reales. API, frontends y MCP validan al arrancar las variables
obligatorias de staging/production.

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
MCP_CI_KEY=...
MCP_DEVELOPER_KEY=...
# Opcionales: sin ellas la funcionalidad responde 503 explícito en vez de fallar.
EMAIL_WEBHOOK_URL=...        # entrega de los avisos de estado de orden (HU-055)
GITHUB_TOKEN=...             # disparo de los pipelines CI/CD desde el MCP (HU-046/047)
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

Validación MCP: **26 tools** descubiertas, las mismas del anexo de A13. `manage_users` usa rol admin; las suites `run_unit_tests`, `run_integration_tests` y `run_accessibility_audit` usan la key CI con permiso `qa:run`; `trigger_ci_pipeline` y `trigger_deployment` usan esa misma key con `ci:trigger` / `deploy:trigger`.

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
