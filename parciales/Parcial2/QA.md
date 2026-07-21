# QA automatizado de UrbanSprout

## Suites

- `npm run test:unit:pure`: lógica pura sin base real, con cobertura Bun — precios, productos, checkout e inventario, template de emails, percentiles de latencia, armado del PDF de factura y diccionario de traducciones.
- `npm run test:unit`: lo anterior más configuración por entorno, rate limiting y repositorio Mongo.
- `npm run test:components`: ProductCard, CartDropdown y CheckoutButton con React Testing Library/jsdom.
- `npm run test:e2e`: integración de API, storefront y backoffice contra una MongoDB aislada y eliminable.
- `npm run test:a11y`: aXe WCAG 2.1 AA, navegación por teclado e imágenes con texto alternativo.

La HU-043 mencionaba SQLite, pero el stack final obligatorio usa MongoDB. La suite emplea `urbansprout_e2e` en una instancia Mongo separada, inicializada y destruida en cada ejecución.

Todas las suites se ejecutan en GitHub Actions. Las regresiones de accesibilidad serious/critical bloquean el pipeline; el resto se publica como warning.

## Cómo se prueban las integraciones externas

El entorno de pruebas **no** tiene llaves de Stripe ni token de GitHub, a propósito: una suite que dependa de un tercero deja de ser determinística. El contrato que se verifica es que cada endpoint degrade de forma explícita.

| Funcionalidad | Sin credencial | Qué se verifica |
|---|---|---|
| Reembolsos (HU-030) | — | 401 sin key, 403 sin `orders:refund`, 404 si la orden no existe, 400 si el monto es inválido |
| Tarjetas guardadas (HU-032) | Stripe | 401 sin sesión, 503 `SERVICE_UNAVAILABLE` con sesión válida |
| Pipelines (HU-046/047) | GitHub | 401 sin key, 403 sin el permiso propio, 503 con la key de CI |
| Facturas (HU-033) | — | 401 sin sesión, 404 si la orden no existe, 409 si no está pagada |

La lógica que sí es determinística —cálculo de impuestos, estructura del PDF, percentiles, escapado del email, cobertura de traducciones— se cubre en las pruebas unitarias puras.
