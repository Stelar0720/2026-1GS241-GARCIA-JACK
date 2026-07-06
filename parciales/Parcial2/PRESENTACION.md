# UrbanSprout — Presentación (borrador, 5 min)

> E-commerce B2C de kits de cultivo urbano. React 19 + Bun + SQLite + servidor MCP.

## Guion por bloques (~5 min)

### 1. El problema (~45 s)
Mucha gente en ciudades quiere cultivar sus propios alimentos pero **no tiene tierra, espacio ni experiencia**. Vive en apartamentos, balcones chicos, zonas sin acceso a tierra fértil.

**UrbanSprout** resuelve eso: vende **kits de cultivo listos para arrancar** (semillas + sustrato + macetas + guía) para espacios reducidos. El cliente compra online, paga con tarjeta y empieza a cultivar la misma tarde.

### 2. Qué construimos (~45 s)
Una plataforma e-commerce completa, con 3 piezas desacopladas:
- **Storefront** (React + Vite): landing, catálogo, carrito persistente, checkout.
- **Backoffice admin** (React + Vite, app independiente): gestión de productos, inventario y órdenes.
- **API de datos** (Bun): productos, órdenes, inventario, pagos con Stripe, webhooks.
- **Servidor MCP**: expone operaciones a agentes de IA bajo autenticación por rol.

### 3. Demo en vivo (~2 min 30 s) — el corazón
1. **Storefront**: mostrar catálogo → agregar al carrito → recargar la página (el carrito **persiste**) → checkout con Stripe → página de éxito.
2. **Backoffice**: crear un producto nuevo → aparece en la tienda → cambiar estado de una orden.
3. **MCP** (lo diferenciador): desde Claude Code, con la key de **admin**, llamar:
   - `search_products` (público)
   - `get_business_metrics` (revenue, órdenes, AOV)
   - `generate_sales_report`
   - `query_audit_logs` (muestra que cada acción quedó registrada)
   - Cambiar a la key de **client** → intentar `get_business_metrics` → **rechazo 403** (demuestra la autenticación por rol).

### 4. Cómo funciona por dentro (~45 s)
- **React 19** en storefront y backoffice; estado de carrito en `localStorage`.
- **Bun** sirve la API (`Bun.serve`) con **SQLite** como persistencia; webhooks de Stripe con validación de firma y deduplicación.
- **MCP** (Model Context Protocol): 10 tools, cada una con un permiso; el servidor resuelve su rol vía `/auth/whoami` y el backend valida la API key (`Authorization: Bearer`).
- **QA**: 21 pruebas Playwright deterministas (storefront + backoffice + API) que corren en **CI de GitHub Actions** en cada push/PR.

### 5. Cierre (~15 s)
Repo + tablero de GitHub Projects + URL desplegada. Todo el equipo domina de React a Bun y el MCP.

---

## Reparto sugerido (todo el grupo presenta)
| Persona | Bloque |
|---|---|
| Integrante A | Problema + qué construimos (1, 2) |
| Integrante B | Demo storefront + backoffice (3.1, 3.2) |
| Integrante C | Demo MCP + auth por rol (3.3) |
| Todos | Preguntas / cómo funciona por dentro (4) |

## Enlaces a tener a mano (completar)
- Repo: `https://github.com/Stelar0720/2026-1GS241-GARCIA-JACK/tree/main/parciales/Parcial2`
- Despliegue: `https://urbansprout-web.fly.dev` *(pendiente de deploy)*
- GitHub Project: *(pendiente de crear el tablero)*

## Preguntas típicas del profe (y respuesta corta)
- **¿Por qué Bun + SQLite y no Hono + MongoDB?** Es el stack que ya traíamos del MVP; la consigna dice "mismo stack que ya traían". `Bun.serve` nativo nos alcanza para el volumen actual; migrar a Hono/Mongo es una mejora futura sin valor para este hito.
- **¿La auth del MCP es real?** Sí: sin key = público (solo búsqueda); cada key mapea a un rol; el backend rechaza con 401/403. Se demuestra en vivo.
- **¿Qué cubren las pruebas?** Storefront (home, carrito, checkout, tema), backoffice (CRUD de productos) y la API (health + superficie de auth). Corren solas en CI.
