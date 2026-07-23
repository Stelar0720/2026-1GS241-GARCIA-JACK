# HU-069 — Cierre semestral consistente y seguro

## Historia

Como equipo de UrbanSprout, queremos cerrar las inconsistencias detectadas en la
fase final para grabar y entregar una versión demostrable, segura y coherente con
la documentación del semestral.

## Criterios de aceptación

1. Un reembolso se reclama atómicamente antes de llamar a Stripe.
2. Los reintentos de un reembolso usan una clave de idempotencia estable.
3. Una orden no puede recibir un segundo reembolso ni superar su total.
4. La notificación posterior refleja el estado real de la orden; un reembolso
   parcial no se anuncia como reembolso total.
5. El alta de tarjetas permite introducir y confirmar una tarjeta con Stripe
   Elements, sin enviar sus datos al API de UrbanSprout.
6. La gestión de tarjetas conserva paridad completa en español e inglés.
7. Dos solicitudes concurrentes para crear el cliente Stripe reutilizan un solo
   vínculo y eliminan el customer huérfano.
8. El CD solo aprueba un despliegue cuando `/version` reporta el SHA esperado;
   `desconocido` no se considera evidencia válida.
9. Lint, typecheck, componentes, build y E2E terminan correctamente.

## Alcance de cierre

Esta historia corrige defectos de la entrega final. Los filtros avanzados,
bundles, analítica de embudo y suscripciones permanecen en el backlog comercial
y no se presentan como terminados durante la grabación.

## Evidencia esperada para la grabación

- Dashboard del cliente mostrando el formulario seguro de nueva tarjeta.
- Cambio ES/EN aplicado también al módulo de tarjetas.
- Backoffice mostrando la acción de reembolso y su validación.
- Ejecución de las pruebas automatizadas y build sin errores.
- Endpoint `/version` identificando el commit desplegado.
