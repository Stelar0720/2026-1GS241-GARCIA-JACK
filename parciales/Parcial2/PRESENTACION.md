# UrbanSprout — Guion de avance y demostración

> E-commerce B2C de kits de cultivo urbano. React 19 + Bun + Hono + MongoDB Atlas + servidor MCP.

## Guion por bloques (~5 min)

### 1. El problema (~25 s)
Mucha gente en ciudades quiere cultivar sus propios alimentos pero **no tiene tierra, espacio ni experiencia**. Vive en apartamentos, balcones chicos, zonas sin acceso a tierra fértil.

**UrbanSprout** resuelve eso: vende **kits de cultivo listos para arrancar** (semillas + sustrato + macetas + guía) para espacios reducidos. El cliente compra online, paga con tarjeta y empieza a cultivar la misma tarde.

### 2. Qué construimos (~35 s)
Una plataforma e-commerce completa, con 3 piezas desacopladas:
- **Storefront** (React + Vite): landing, catálogo, carrito persistente, checkout.
- **Backoffice admin** (React + Vite, app independiente): gestión de productos, inventario y órdenes.
- **API de datos** (Bun + Hono + MongoDB): productos, órdenes, inventario, pagos con Stripe y webhooks.
- **Servidor MCP**: expone operaciones a agentes de IA bajo autenticación por rol.

### 3. Demo en vivo (~3 min 20 s) — 10 pruebas manuales
1. La home carga el hero, el catálogo y tres productos.
2. El detalle de un producto muestra contenido y permite agregarlo.
3. El carrito permite agregar, cambiar cantidad y eliminar productos.
4. El carrito persiste después de recargar la página.
5. El selector claro/oscuro cambia el tema y lo conserva al recargar.
6. Las rutas de checkout exitoso y cancelado muestran mensajes distintos.
7. El dashboard protege el acceso o muestra el historial del usuario autenticado.
8. El backoffice lista productos y órdenes desde la API común.
9. El backoffice valida el formulario y permite crear, editar y eliminar un producto.
10. El backoffice permite actualizar stock y estado de una orden.

Como evidencia adicional, mostrar brevemente el **MCP** con la key de **admin**:
   - `search_products` (público)
   - `get_business_metrics` (revenue, órdenes, AOV)
   - `generate_sales_report`
   - `query_audit_logs` (muestra que cada acción quedó registrada)
   - Cambiar a la key de **client** → intentar `get_business_metrics` → **rechazo 403** (demuestra la autenticación por rol).

### 4. Cómo funciona por dentro (~30 s)
- **React 19** en storefront y backoffice; estado de carrito en `localStorage`.
- **Bun + Hono** sirven la API con **MongoDB Atlas**; transacciones de inventario y webhooks Stripe con firma y deduplicación persistente.
- **MCP** (Model Context Protocol): 10 tools, cada una con un permiso; el servidor resuelve su rol vía `/auth/whoami` y el backend valida la API key (`Authorization: Bearer`).
- **QA**: 26 pruebas Playwright (storefront + backoffice + API), además de lint y build, integradas en **GitHub Actions**.

### 5. Cierre (~10 s)
Repo + tablero de GitHub Projects + URL desplegada. Todo el equipo domina de React a Bun y el MCP.

---

## Reparto sugerido (todo el grupo presenta)
| Persona | Bloque |
|---|---|
| Integrante A | Problema + qué construimos (1, 2) |
| Integrante B | Demo storefront + backoffice (3.1, 3.2) |
| Integrante C | Demo MCP + auth por rol (3.3) |
| Todos | Preguntas / cómo funciona por dentro (4) |

## Enlaces para la sustentación
- Repo: `https://github.com/Stelar0720/2026-1GS241-GARCIA-JACK/tree/main/parciales/Parcial2`
- Storefront: `https://urbansprout-storefront-production.up.railway.app`
- Backoffice: `https://urbansprout-backoffice-production.up.railway.app`
- API health: `https://urbansprout-api-production.up.railway.app/health`
- GitHub Project: `https://github.com/users/Stelar0720/projects/2`

## Preguntas típicas del profe (y respuesta corta)
- **¿Por qué Bun + Hono + MongoDB?** Es el stack obligatorio del cierre. Hono organiza el router y middleware; Atlas aporta persistencia remota, replica set y transacciones para evitar sobreventa.
- **¿La auth del MCP es real?** Sí: sin key = público (solo búsqueda); cada key mapea a un rol; el backend rechaza con 401/403. Se demuestra en vivo.
- **¿Qué cubren las pruebas?** Storefront (home, carrito, checkout, tema), backoffice (CRUD de productos) y la API (health + superficie de auth). Corren solas en CI.
