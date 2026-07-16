# QA automatizado de UrbanSprout

## Suites

- `npm run test:unit:pure`: lógica de precios, productos, checkout e inventario sin base real; genera cobertura Bun.
- `npm run test:components`: ProductCard, CartDropdown y CheckoutButton con React Testing Library/jsdom.
- `npm run test:e2e`: integración de API, storefront y backoffice contra una MongoDB aislada y eliminable.
- `npm run test:a11y`: aXe WCAG 2.1 AA, navegación por teclado e imágenes con texto alternativo.

La HU-043 mencionaba SQLite, pero el stack final obligatorio usa MongoDB. La suite emplea `urbansprout_e2e` en una instancia Mongo separada, inicializada y destruida en cada ejecución.

Las cuatro suites se ejecutan en GitHub Actions. Las regresiones de accesibilidad serious/critical bloquean el pipeline; el resto se publica como warning.
