# Deploy a Fly.io

Config lista en `fly.api.toml`, `fly.web.toml` y `fly.admin.toml`. Pasos manuales (requieren cuenta Fly.io propia):

## 1. Instalar flyctl y loguearte

```bash
# Windows (PowerShell)
iwr https://fly.io/install.ps1 -useb | iex

fly auth signup   # o fly auth login si ya tenés cuenta
```

## 2. Crear las apps (una vez)

```bash
cd parciales/Parcial2
fly apps create urbansprout-api
fly apps create urbansprout-web
fly apps create urbansprout-admin   # opcional, si el free allowance alcanza
```

## 3. Volumen persistente para SQLite (solo la API lo necesita)

```bash
fly volumes create urbansprout_data --app urbansprout-api --region mia --size 1
```

## 4. Secrets (no van en los .toml, se cargan aparte)

```bash
fly secrets set STRIPE_SECRET_KEY=sk_... STRIPE_WEBHOOK_SECRET=whsec_... --app urbansprout-api
# Keys del MCP (auth por rol). Generar valores aleatorios y guardarlos:
fly secrets set MCP_ADMIN_KEY=... MCP_SUPPORT_KEY=... MCP_CLIENT_KEY=... --app urbansprout-api
fly secrets set VITE_CLERK_PUBLISHABLE_KEY=pk_... ADMIN_EMAILS=admin@urbansprout.com --app urbansprout-web
fly secrets set VITE_CLERK_PUBLISHABLE_KEY=pk_... --app urbansprout-admin
```

> El servidor MCP se conecta apuntando `API_URL` al `urbansprout-api` desplegado y usando una de esas keys en `MCP_API_KEY` (ver `mcp-server/README.md`).

## 5. Deploy

```bash
fly deploy --config fly.api.toml --app urbansprout-api
fly deploy --config fly.web.toml --app urbansprout-web
fly deploy --config fly.admin.toml --app urbansprout-admin   # opcional
```

## Notas

- Los Dockerfiles existentes corren en modo desarrollo (`bun run dev` / `npm run dev`). Funciona para este avance; migrar a build de producción queda como mejora futura.
- Si el free allowance de la cuenta no alcanza para las 3 apps, priorizar `urbansprout-api` + `urbansprout-web` (el storefront funcionando es lo que pide la rúbrica); el backoffice puede quedar para acceso local en este avance.
- `region = "mia"` (Miami) por cercanía a Panamá; cambiarlo si Fly sugiere otra región más barata/disponible para la cuenta.
