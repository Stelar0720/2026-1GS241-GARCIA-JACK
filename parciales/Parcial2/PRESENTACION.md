# UrbanSprout — Guion de sustentación (10 minutos exactos)

> E-commerce B2C de kits de cultivo urbano. React 19 + Bun + Hono + MongoDB Atlas + servidor MCP.
> Reparto: **Jack**, **Nico**, **Angel**. Duración objetivo: **10:00**.

---

## Antes de grabar — checklist de 5 minutos

**Pestañas abiertas y precargadas, en este orden:**

| # | Pestaña | URL |
|---|---|---|
| 1 | Storefront | https://urbansprout-storefront-production.up.railway.app |
| 2 | Backoffice | https://urbansprout-backoffice-production.up.railway.app |
| 3 | GitHub Issues | https://github.com/Stelar0720/2026-1GS241-GARCIA-JACK/issues?q=is%3Aissue |
| 4 | GitHub Project | https://github.com/users/Stelar0720/projects/2 |
| 5 | GitHub Actions | https://github.com/Stelar0720/2026-1GS241-GARCIA-JACK/actions |
| 6 | Terminal con Claude Code | MCP ya conectado con la key **admin** |

**Preparación previa:**

- Backoffice: clave administrativa ya validada (evita perder 15 segundos escribiéndola).
- Storefront: sesión de Clerk **iniciada** y con al menos **una orden pagada** en el historial, para poder descargar la factura.
- Carrito **vacío** al empezar, y `localStorage` sin idioma guardado (para que arranque en español).
- Tarjeta de prueba de Stripe a mano: `4242 4242 4242 4242`, cualquier fecha futura, cualquier CVC.
- Resolución 1920×1080, zoom del navegador al 100 %, modo claro.
- Silenciar notificaciones del sistema.

**Regla de oro:** si algo falla en vivo, **no se repite el intento**. Se dice *"esa parte queda cubierta por las pruebas E2E"* y se avanza. Perder 40 segundos en un reintento cuesta más que la funcionalidad.

---

## BLOQUE 1 — Presentación (0:00 → 4:30)

### JACK · 0:00 → 0:50 · El problema
*(pantalla: portada o storefront quieto, sin tocar nada)*

> Buenos días. Somos Jack, Nico y Angel, y les vamos a presentar **UrbanSprout**.
>
> Arrancamos con un problema que vemos todos los días en Ciudad de Panamá: mucha gente quiere cultivar sus propios alimentos, pero vive en apartamentos. No tiene patio, no tiene tierra, y sobre todo no tiene experiencia. Compran una matita, se les muere en dos semanas, y no vuelven a intentarlo.
>
> El problema real no es la falta de ganas. Es que **empezar es complicado**: hay que averiguar qué semilla sirve para el clima, qué sustrato, cuánta luz, cada cuánto regar, y comprar cinco cosas en tres lugares distintos.
>
> UrbanSprout resuelve exactamente eso.

### NICO · 0:50 → 1:50 · La solución
*(pantalla: storefront, hacer scroll lento por la landing mientras habla)*

> UrbanSprout es una tienda en línea que vende **kits de cultivo listos para arrancar**. Cada kit trae las semillas seleccionadas para el clima de Panamá, el sustrato ya preparado, las macetas y una guía paso a paso.
>
> El cliente entra, elige el kit según el espacio que tiene, paga con tarjeta y esa misma tarde puede sembrar. Sin decisiones técnicas, sin ir a tres tiendas.
>
> Nuestro cliente es una persona de ciudad, entre veinticinco y cuarenta y cinco años, que vive en apartamento y quiere producir algo de su comida, pero necesita que alguien le quite la fricción de encima.
>
> Y del otro lado del mostrador está el operador del negocio, que necesita administrar catálogo, inventario, pedidos y devoluciones sin pelearse con una hoja de cálculo. Por eso la plataforma tiene **dos caras**: la tienda y el panel administrativo.

### ANGEL · 1:50 → 3:00 · La arquitectura
*(pantalla: diagrama de arquitectura, o el repositorio mostrando las carpetas `src/`, `admin-backoffice/`, `bun-api/`, `mcp-server/`)*

> Técnicamente son **cuatro piezas desacopladas**.
>
> La primera es el **storefront**, en React 19 con Vite: la landing, el catálogo, el carrito y el checkout.
>
> La segunda es el **backoffice**, una aplicación React independiente, en otro puerto y otro despliegue. Está separada a propósito: un problema en el panel administrativo no puede tumbar la tienda.
>
> La tercera es la **API**, en **Bun con Hono**, sobre **MongoDB Atlas**. Ahí viven productos, órdenes, inventario, los pagos con Stripe y los webhooks. Usamos transacciones de Mongo para el inventario, porque dos personas comprando la última unidad al mismo tiempo no pueden generar una sobreventa.
>
> Y la cuarta pieza es el **servidor MCP**: expone la operación del negocio a agentes de inteligencia artificial, **bajo autenticación por rol**. Son veintiséis herramientas, y cada una exige un permiso concreto. Se lo mostramos en vivo al final.

### JACK · 3:00 → 3:50 · Cómo lo gestionamos
*(pantalla: pestaña 3 → Issues, luego pestaña 4 → Project, luego pestaña 5 → Actions)*

> Todo el trabajo se gestionó con **GitHub Issues y GitHub Projects**.
>
> Partimos las historias de usuario de la entrega A13 en **setenta tickets**, uno por historia, etiquetados por prioridad. *(mostrar la lista de issues cerrados)* Hoy están **los setenta cerrados**, y cada uno se cerró desde un pull request que lo referencia. No hay código que haya entrado a `main` sin pasar por un PR.
>
> *(cambiar a la pestaña de Actions)* Cada pull request dispara el pipeline de **GitHub Actions**: lint, chequeo de tipos, build, pruebas unitarias, de componentes, end-to-end y de accesibilidad. Si algo se pone rojo, el PR no se puede mergear.
>
> Y cuando `main` queda verde, se despliega solo a **staging**. Producción va por una rama aparte y exige **aprobación manual**.

### NICO · 3:50 → 4:30 · Calidad
*(pantalla: la corrida verde de Actions, abrir el paso de E2E)*

> Sobre calidad tenemos cuatro suites.
>
> **Pruebas unitarias puras**, con cobertura, sobre la lógica que no debe fallar: cálculo de precios, cupones, reglas de inventario, impuestos de la factura y percentiles de latencia.
>
> **Pruebas de componentes** con React Testing Library.
>
> **Sesenta pruebas end-to-end con Playwright**, que cubren la tienda, el backoffice y la API, corriendo contra una MongoDB aislada que se crea y se destruye en cada ejecución. Por eso son determinísticas: no dependen de datos que quedaron de ayer.
>
> Y una **auditoría de accesibilidad automática** con aXe, contra WCAG 2.1 nivel AA. Una regresión grave bloquea el pipeline.

---

## BLOQUE 2 — Demostración en vivo (4:30 → 9:30)

### JACK · 4:30 → 6:00 · La tienda
*(pantalla: pestaña 1, storefront de producción — recalcar que es la URL desplegada, no localhost)*

> Esto es el sitio **desplegado en Railway**, no es local.

**Acciones mientras habla, en este orden:**

1. **Scroll por la home** →
   > La landing tiene el hero, la propuesta de valor, estadísticas y prueba social.

2. **Clic en un filtro de categoría** →
   > El catálogo filtra por categoría, y cada tarjeta tiene efecto tilt en tres dimensiones.

3. **Clic en un producto** →
   > Cada producto tiene su página de detalle: especificaciones, qué incluye, los pasos y productos relacionados.

4. **Agregar al carrito, abrir el carrito, subir la cantidad a 2** →
   > Agrego al carrito. Puedo cambiar cantidades desde acá.

5. **Eliminar un producto y usar "Deshacer"** →
   > Si elimino algo por error, tengo cinco segundos para deshacerlo.

6. **Señalar la barra de envío gratis** →
   > Y esta barra muestra cuánto falta para el envío gratis, que arranca en cincuenta y cinco dólares.

7. **Recargar la página (F5) con el carrito lleno** →
   > Recargo la página… y el carrito sigue ahí. Se persiste en `localStorage`.

8. **Aplicar el cupón `WELCOME10`** →
   > También validamos cupones contra la base de datos: el descuento se aplica antes de mandar al cliente a Stripe.

9. **Clic en el toggle de tema, luego en el selector de idioma → English** →
   > Tenemos modo claro y oscuro, que respeta la preferencia del sistema y se recuerda… y selector de idioma español-inglés, que también persiste.

10. **Volver a español** →
    > Vuelvo a español y le paso a Nico.

### NICO · 6:00 → 7:20 · Pago y cuenta del cliente
*(pantalla: sigue en el storefront, con sesión iniciada)*

**Acciones:**

1. **Clic en "Ir a pagar"** →
   > Al pagar, la API crea una sesión de **Stripe Checkout**. Nunca tocamos datos de tarjeta: eso lo maneja Stripe.

2. **En Stripe: `4242 4242 4242 4242`, fecha futura, CVC, pagar** →
   > Uso la tarjeta de prueba.

3. **Vuelta a `/checkout/success`** →
   > Stripe nos devuelve a la página de éxito. Y en paralelo Stripe manda un **webhook** a nuestra API, que valida la firma, crea la orden y descuenta el stock. Si el mismo evento llega dos veces, lo ignoramos: deduplicamos por identificador de evento.

4. **Ir a "Mi cuenta"** →
   > En el panel del cliente está el historial completo, con el estado de cada orden.

5. **Clic en "Descargar factura"** → *(se descarga el PDF; abrirlo un segundo)*
   > De cada orden pagada puedo descargar la **factura en PDF**, que la genera el servidor con el desglose de subtotal, ITBMS y total.

6. **Hacer scroll hasta wishlist y métodos de pago** →
   > También tiene lista de deseos y tarjetas guardadas, que usan SetupIntents de Stripe.

7. **Señalar la sección de privacidad** →
   > Y acá abajo, herramientas de privacidad: el usuario puede exportar todos sus datos en JSON o pedir la eliminación de su cuenta, que anonimiza sus órdenes.

### ANGEL · 7:20 → 8:40 · El backoffice
*(pantalla: pestaña 2, backoffice de producción)*

**Acciones:**

1. **Mostrar la lista de productos** →
   > Este es el panel administrativo, que es una aplicación aparte. Desde acá se administra el catálogo: crear, editar, desactivar y eliminar productos, con validación en el formulario.

2. **Señalar el inventario y una alerta de stock** →
   > El inventario maneja stock y stock mínimo, y levanta una alerta cuando un producto baja del umbral.

3. **Ir a la tabla de órdenes** →
   > Acá están todas las órdenes. Puedo cambiar el estado operativo de cada una.

4. **En la orden recién pagada: escribir un motivo y hacer clic en "Reembolsar"** →
   > Y esta es la parte nueva: **reembolsos**. Escribo el motivo, y el sistema llama a la API de Stripe, ejecuta la devolución, marca la orden como reembolsada, **devuelve el stock** y deja el evento en el log de auditoría. Puede ser total o parcial.

5. **Mostrar la orden ya en estado "Reembolsada"** →
   > Ahí quedó.

6. **Bajar al panel de usuarios administrativos** →
   > También gestionamos el equipo: invitar usuarios, cambiar roles y suspender accesos.

7. **Bajar al panel de rendimiento** →
   > Y este panel es el monitoreo del API: latencia percentil cincuenta, noventa y cinco y noventa y nueve por endpoint, tasa de errores y disponibilidad en vivo.

8. **Bajar a datos y seguridad** →
   > Por último, API keys que se guardan hasheadas, backups de la base y migraciones versionadas.

### ANGEL · 8:40 → 9:30 · El servidor MCP
*(pantalla: pestaña 6, terminal con Claude Code)*

> Y cerramos con la pieza que integra todo esto con agentes de inteligencia artificial.

**Acciones:**

1. **Mostrar el `.mcp.json`** →
   > El servidor MCP está importado en Claude Code. Se lanza con una API key, y al arrancar le pregunta a nuestra API qué rol tiene esa key y qué permisos le corresponden.

2. **Pedir: "buscá productos de cultivo con search_products"** →
   > `search_products` es pública, funciona sin key.

3. **Pedir: "dame las métricas de negocio"** → *(corre `get_business_metrics`)*
   > Con la key de **administrador** puedo pedir métricas de negocio: ingresos, órdenes y ticket promedio.

4. **Pedir: "consultá los logs de auditoría"** → *(corre `query_audit_logs`)*
   > Y acá está el **reembolso que acabamos de hacer hace treinta segundos**, registrado con su actor y su motivo. La trazabilidad es real.

5. **Cambiar la variable a la key de cliente y reintentar `get_business_metrics`** →
   > Ahora cambio la key por la de **cliente**, y pido lo mismo… **rechazado**. El servidor devuelve un error de permisos y el backend responde 403.
   >
   > Eso es lo importante: la autenticación **no está en el agente**, está en el backend. Aunque alguien modifique el cliente MCP, la API sigue diciendo que no.

---

## BLOQUE 3 — Cierre (9:30 → 10:00)

### JACK · 9:30 → 9:45
> Para cerrar: las setenta historias de usuario de A13 están implementadas y desplegadas, con los setenta tickets cerrados desde pull requests.

### NICO · 9:45 → 9:55
> Con sesenta pruebas Playwright determinísticas sobre la tienda, el backoffice y la API, más auditoría de accesibilidad, todo corriendo en GitHub Actions.

### ANGEL · 9:55 → 10:00
> Y con las veintiséis herramientas MCP bajo autenticación por rol. Gracias, quedamos atentos a sus preguntas.

---

## Banco de respuestas — las 5 preguntas del profesor

Cada uno debe poder responder **cualquiera** de estas. El profesor evalúa que **todo el grupo** domine el proyecto, no que cada uno sepa solo su parte.

### Sobre React

**¿Por qué React 19 y qué usan de esa versión?**
> Storefront y backoffice son React 19 con Vite. El estado del carrito vive en `localStorage` con un hook propio. Usamos Error Boundaries por sección —home, productos y dashboard— para que un fallo en una parte no tumbe la navegación completa.

**¿Cómo manejan el estado del carrito?**
> Con un hook `useStorefrontCart` que sincroniza contra `localStorage`. No metimos Redux ni Zustand porque el estado compartido es un arreglo de líneas de carrito; una librería de estado global para eso es más código para mantener sin ganar nada.

**¿Cómo evitan que un doble clic genere dos checkouts?**
> Hay una bandera de `checkingOut` que deshabilita el botón mientras la petición está en vuelo.

### Sobre Bun y Hono

**¿Por qué Bun y Hono?**
> Bun es el runtime que exigía el cierre del proyecto, y trae el ejecutor de pruebas y el gestor de paquetes incluidos, así que no necesitamos Jest ni ts-node. Hono nos da el router y el middleware; el manejo de errores y el registro de cada petición son middlewares que se aplican a todas las rutas.

**¿Cómo está organizada la API?**
> Un middleware global captura errores no manejados y los manda al feed de errores con contexto, otro registra latencia y estado de cada petición, y después el router resuelve por método y ruta. Los módulos están separados por responsabilidad: `db`, `auth`, `payments`, `invoices`, `notifications`, `performance`, `pipelines`.

**¿Cómo evitan la sobreventa de inventario?**
> Con transacciones de MongoDB. La reserva de stock y la creación de la orden pasan en la misma transacción, y el descuento de stock usa una condición sobre el documento: si no hay unidades suficientes, la operación no encuentra el documento y la transacción falla completa.

### Sobre MongoDB

**¿Por qué MongoDB y no SQL?**
> Era el stack obligatorio del cierre. En A13 habíamos escrito SQLite y lo migramos. Atlas nos aporta persistencia remota gratuita, replica set —que es lo que habilita las transacciones— y backups.

**¿Cómo manejan cambios de esquema?**
> Con migraciones versionadas que corren automáticamente al arrancar la API, y con rollback documentado.

### Sobre el MCP

**¿Qué es MCP y por qué lo integraron?**
> Model Context Protocol es un protocolo para que un agente de IA use herramientas externas. Nosotros exponemos la operación del negocio —catálogo, órdenes, métricas, reportes, auditoría— como veintiséis herramientas que un agente puede llamar desde Claude Code o Codex.

**¿La autenticación es real o es decorativa?**
> Es real y está en **dos capas**. El servidor MCP consulta `/auth/whoami` al arrancar para saber su rol y deshabilita las herramientas que no le corresponden. Pero la validación que importa está en el backend: cada endpoint sensible verifica el permiso y responde 401 o 403. Aunque alguien parchee el cliente MCP, la API sigue rechazando.

**¿Qué roles tienen?**
> `public` sin key, con solo búsqueda y traducciones. `client` para operaciones del propio cliente. `support`, que lee catálogo y órdenes pero no edita. `admin`, con todo. `ci`, para correr las suites de pruebas y disparar los pipelines. Y `developer`, para logs, errores y métricas de rendimiento.

**¿Un agente podría desplegar a producción solo?**
> Puede disparar el workflow, pero no completar el despliegue: producción está detrás de un environment protegido de GitHub que exige aprobación humana. El agente no se salta ese control.

### Sobre despliegue y pruebas

**¿Dónde está desplegado y cuánto cuesta?**
> Railway para los tres servicios y MongoDB Atlas M0 para la base. Todo en capa gratuita.

**¿Cómo prueban lo que depende de Stripe si no tienen llaves en CI?**
> A propósito no ponemos credenciales de terceros en el entorno de pruebas, porque una suite que depende de un servicio externo deja de ser determinística. Lo que verificamos es que cada endpoint degrade de forma explícita: sin Stripe configurado responde 503, no un error 500 opaco. Y la lógica que sí es nuestra —cálculo de impuestos, estructura del PDF, percentiles, escapado del email— se cubre en pruebas unitarias puras.

**¿Qué cubren las pruebas E2E?**
> Sesenta pruebas: la tienda completa —home, catálogo, detalle, carrito persistente, cupones, tema, idioma, páginas de checkout—, el backoffice —CRUD de productos, órdenes, reembolsos, usuarios, rendimiento— y la API —salud, permisos por rol, wishlist, reseñas, API keys, backups y GDPR.

---

## Distribución de tiempos (resumen)

| Tramo | Quién | Contenido | Duración |
|---|---|---|---|
| 0:00 – 0:50 | Jack | El problema | 50 s |
| 0:50 – 1:50 | Nico | La solución y el cliente | 60 s |
| 1:50 – 3:00 | Angel | Arquitectura | 70 s |
| 3:00 – 3:50 | Jack | Issues, Projects, PRs, CI/CD | 50 s |
| 3:50 – 4:30 | Nico | Calidad y pruebas | 40 s |
| 4:30 – 6:00 | Jack | Demo: tienda | 90 s |
| 6:00 – 7:20 | Nico | Demo: pago y cuenta | 80 s |
| 7:20 – 8:40 | Angel | Demo: backoffice | 80 s |
| 8:40 – 9:30 | Angel | Demo: MCP y roles | 50 s |
| 9:30 – 10:00 | Los tres | Cierre | 30 s |

**Presentación 4:30 · Demostración 5:00 · Cierre 0:30 · Total 10:00**

---

## Enlaces para la sustentación

- Repo: `https://github.com/Stelar0720/2026-1GS241-GARCIA-JACK/tree/main/parciales/Parcial2`
- Storefront: `https://urbansprout-storefront-production.up.railway.app`
- Backoffice: `https://urbansprout-backoffice-production.up.railway.app`
- API health: `https://urbansprout-api-production.up.railway.app/health`
- GitHub Project: `https://github.com/users/Stelar0720/projects/2`
