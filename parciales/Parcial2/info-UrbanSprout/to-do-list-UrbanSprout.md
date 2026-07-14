# To-Do List - UrbanSprout

Basado en el PRD, el plan de ejecución y la estrategia de agentes/habilidades.

## P0 (crítico)

1. [x] Decidir framework de backoffice: **React + Vite**.
2. [x] Separar backoffice admin en app independiente.
3. [x] Definir servicio/API con Bun + Hono para persistencia de órdenes e inventario en MongoDB.
4. [x] Crear `docker-compose.yml` para orquestar storefront, backoffice, API y MongoDB.
5. [x] Auditar configuración base de Clerk/Stripe por entorno y documentarla en `DEPLOY.md`.
6. [x] Estandarizar mensajes de error en auth, checkout y rutas protegidas.
7. [x] Verificar reglas de rol admin (`metadata` + `ADMIN_EMAILS`).
8. [x] Crear endpoint de webhook Stripe con validación de firma.
9. [x] Definir modelo de datos de órdenes.
10. [x] Implementar deduplicación de eventos webhook por `event.id` durante la ejecución del API.
11. [x] Mostrar historial de compras en dashboard del cliente.

## P1 (operación)

1. [x] Crear módulo admin para listar órdenes.
2. [x] Permitir actualización de estado operativo del pedido.
3. [ ] Agregar filtros admin por estado, fecha y producto.
4. [ ] Completar alerta configurable de stock bajo (el inventario y la edición de stock ya funcionan).

## P2 (crecimiento comercial)

1. [x] Implementar carrito multi-producto persistente en `localStorage`.
2. [x] Adaptar checkout para múltiples `line_items`.
3. [ ] Agregar cupones y bundles básicos.
4. [ ] Instrumentar analítica de embudo (visita -> checkout -> pago).

## P3 (retención)

1. [ ] Definir planes iniciales de suscripción mensual.
2. [ ] Integrar cobro recurrente en Stripe.
3. [ ] Mostrar estado de suscripción en dashboard de cliente.

## Cierre por fase

1. [ ] Ejecutar lint, build y e2e al cerrar cada bloque funcional.
2. [ ] Ejecutar code-review de cambios críticos (roles, seguridad, pagos).
3. [ ] Actualizar PRD/plan si cambia alcance o prioridades.

## Agentes y habilidades sugeridas

- Implementación: `general-purpose`
- Validación técnica: `task`
- Revisión de riesgos: `code-review`
- Investigación transversal: `explore`
- Diseño UI/UX: `frontend-design`
- Setup de entorno cloud: `customize-cloud-agent`

## Restricciones técnicas obligatorias

- Backoffice admin en React Vite o TanStack.
- Docker Compose para levantar el stack.
- Stripe para pagos.
- Clerk para autenticación y control de acceso.
- Bun para la capa de datos/base de datos.
