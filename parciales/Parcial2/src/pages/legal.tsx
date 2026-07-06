import { Link } from "react-router-dom";

function LegalLayout({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="container legal-page">
      <article className="panel glass legal-body">
        <nav className="breadcrumb" aria-label="Ruta de navegación">
          <Link to="/">Inicio</Link>
          <span aria-hidden="true">/</span>
          <strong>{title}</strong>
        </nav>
        <h1 className="section-title">{title}</h1>
        <p className="meta">Última actualización: {updated}</p>
        {children}
      </article>
    </main>
  );
}

export function TerminosPage() {
  return (
    <LegalLayout title="Términos y condiciones" updated="junio de 2026">
      <h2>1. Aceptación</h2>
      <p>
        Al comprar en UrbanSprout aceptas estos términos. UrbanSprout es una tienda en línea de kits de
        cultivo urbano operada desde Ciudad de Panamá, República de Panamá.
      </p>
      <h2>2. Productos y precios</h2>
      <p>
        Los precios se expresan en dólares estadounidenses (USD) e incluyen los impuestos aplicables. El
        contenido de cada kit se detalla en su ficha de producto; las imágenes son referenciales y el
        empaque puede variar sin afectar el contenido.
      </p>
      <h2>3. Compra y pago</h2>
      <p>
        Los pagos se procesan a través de Stripe. UrbanSprout no almacena datos de tarjetas. Una orden se
        considera confirmada cuando Stripe reporta el pago como completado; hasta entonces figura como
        pendiente en tu panel.
      </p>
      <h2>4. Envíos</h2>
      <p>
        Entregamos en 24 h dentro de Ciudad de Panamá y San Miguelito, y en 48–72 h al resto del país vía
        courier. El envío es gratuito en compras desde $55. Los tiempos son estimados y pueden variar por
        causas ajenas a UrbanSprout.
      </p>
      <h2>5. Garantía de germinación</h2>
      <p>
        Si sigues la guía incluida y tus semillas no germinan dentro de los 30 días posteriores a la
        entrega, reponemos semillas y sustrato sin costo. Ver la política de devoluciones para el proceso.
      </p>
      <h2>6. Uso del soporte</h2>
      <p>
        El soporte por WhatsApp cubre dudas de cultivo durante las dos primeras semanas desde la entrega.
        Es un acompañamiento de buena fe y no garantiza resultados específicos de cosecha.
      </p>
      <h2>7. Limitación de responsabilidad</h2>
      <p>
        Los kits están destinados a consumo doméstico. UrbanSprout no se hace responsable por usos
        distintos a los descritos en la guía ni por daños derivados de instalación en espacios inadecuados.
      </p>
    </LegalLayout>
  );
}

export function PrivacidadPage() {
  return (
    <LegalLayout title="Política de privacidad" updated="junio de 2026">
      <h2>1. Datos que recopilamos</h2>
      <p>
        Para operar tu cuenta y tus pedidos recopilamos: nombre, correo electrónico, historial de compras y
        dirección de entrega. La autenticación se gestiona con Clerk y los pagos con Stripe; ambos actúan
        como encargados del tratamiento bajo sus propias políticas.
      </p>
      <h2>2. Para qué los usamos</h2>
      <p>
        Usamos tus datos exclusivamente para procesar pedidos, darte acceso a tu panel, brindarte soporte y
        enviarte notificaciones del estado de tu compra. No vendemos ni cedemos tus datos a terceros con
        fines publicitarios.
      </p>
      <h2>3. Dónde se almacenan</h2>
      <p>
        Los datos de pedidos se almacenan en servidores propios de UrbanSprout. Los datos de tarjeta nunca
        pasan por nuestros servidores: los procesa Stripe directamente.
      </p>
      <h2>4. Tus derechos</h2>
      <p>
        Puedes solicitar acceso, corrección o eliminación de tus datos escribiendo a hola@urbansprout.com.
        Respondemos dentro de los 10 días hábiles siguientes a tu solicitud.
      </p>
      <h2>5. Cookies y almacenamiento local</h2>
      <p>
        Usamos almacenamiento local del navegador para recordar tu carrito y tu preferencia de tema
        (claro/oscuro). No usamos rastreadores de terceros con fines publicitarios.
      </p>
    </LegalLayout>
  );
}

export function DevolucionesPage() {
  return (
    <LegalLayout title="Envíos y devoluciones" updated="junio de 2026">
      <h2>1. Tiempos de envío</h2>
      <p>
        Ciudad de Panamá y San Miguelito: 24 h hábiles. Interior del país: 48–72 h vía courier. Recibirás
        el estado de tu orden en tu panel de cliente.
      </p>
      <h2>2. Envío gratis</h2>
      <p>En compras desde $55 el envío es gratuito a todo el país.</p>
      <h2>3. Garantía de germinación (30 días)</h2>
      <p>
        Si tus semillas no germinan siguiendo la guía, escríbenos dentro de los 30 días posteriores a la
        entrega con una foto de tu kit. Te enviamos repuesto de semillas y sustrato sin costo, sin
        necesidad de devolver el kit.
      </p>
      <h2>4. Producto dañado o incompleto</h2>
      <p>
        Si el kit llega golpeado o le falta un componente, repórtalo dentro de las 72 h posteriores a la
        entrega y lo reponemos completo. Guarda el empaque original para el retiro.
      </p>
      <h2>5. Derecho a retracto</h2>
      <p>
        Puedes cancelar una orden pendiente de pago desde tu panel en cualquier momento. Para órdenes
        pagadas y no enviadas, solicita la cancelación por WhatsApp y reembolsamos el 100% por el mismo
        medio de pago.
      </p>
    </LegalLayout>
  );
}
