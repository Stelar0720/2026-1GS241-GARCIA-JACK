import { Product } from "./catalog";

// ============================================================
// Contenido editorial del storefront.
// Centralizado acá para que marketing/copy se ajuste sin tocar componentes.
// ============================================================

export type Stat = {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  label: string;
};

export const HERO = {
  badge: "Cultivo urbano para espacios reales",
  title: "Tu mini huerto en casa, aunque vivas en un apartamento.",
  subtitle:
    "Kits completos con semillas seleccionadas, sustrato listo y guía paso a paso. De la caja a tu primera cosecha en 7 a 21 días — sin experiencia, sin patio y sin herramientas.",
  trust: ["Envío 24–48 h en Panamá", "Garantía de germinación 30 días", "Soporte de cultivo incluido"],
};

export const MARQUEE_ITEMS = [
  "Envío 24–48 h en todo Panamá",
  "Garantía de germinación 30 días",
  "Semillas no transgénicas",
  "Soporte experto por WhatsApp",
  "Materiales reutilizables",
  "Desde $24.90",
];

export const STATS: Stat[] = [
  { value: 1240, suffix: "+", label: "hogares ya cultivan con nosotros" },
  { value: 92, suffix: "%", label: "de cosechas exitosas al primer intento" },
  { value: 7, label: "días hasta ver tu primer brote" },
  { value: 4.8, decimals: 1, suffix: "/5", label: "valoración promedio de clientes" },
];

export const VALUE_PROPS = [
  {
    icon: "📦",
    title: "Todo en una caja",
    text: "Semillas, sustrato, macetas y guía impresa. Abres el kit y siembras: no necesitas comprar nada más.",
  },
  {
    icon: "📏",
    title: "Hecho para espacios chicos",
    text: "Diseñado para balcones, ventanas y mesas de cocina. Cada kit funciona desde 30×30 cm de superficie.",
  },
  {
    icon: "🤝",
    title: "No cultivas solo",
    text: "Guía paso a paso con fotos y soporte por WhatsApp durante tus primeras dos semanas de cultivo.",
  },
  {
    icon: "♻️",
    title: "Sostenible de verdad",
    text: "Macetas reutilizables, empaques reciclables y semillas de proveedores locales certificados.",
  },
];

export const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Elige tu kit",
    text: "Según tu espacio y las horas de luz que tengas. Cada producto indica su nivel y requisitos.",
  },
  {
    step: "02",
    title: "Recíbelo en 24–48 h",
    text: "Enviamos a todo Panamá. El kit llega listo para sembrar, con todo incluido.",
  },
  {
    step: "03",
    title: "Siembra en 15 minutos",
    text: "Sigue la guía ilustrada: sustrato, semillas, riego inicial. Sin herramientas ni experiencia.",
  },
  {
    step: "04",
    title: "Cosecha y repite",
    text: "Primeros brotes en 7–10 días. Cada kit rinde 2 a 3 ciclos completos de cultivo.",
  },
];

export const TESTIMONIALS = [
  {
    name: "María G.",
    location: "San Francisco, Ciudad de Panamá",
    rating: 5,
    text: "Vivo en un piso 12 sin balcón y aun así coseché albahaca y cilantro en mi ventana. La guía es clarísima y el soporte por WhatsApp me salvó cuando me pasé de riego.",
  },
  {
    name: "Roberto C.",
    location: "El Cangrejo, Ciudad de Panamá",
    rating: 5,
    text: "Se lo regalé a mi mamá que 'no tiene mano para las plantas'. A los 10 días me mandó foto de sus microverdes. Ahora quiere el kit premium.",
  },
  {
    name: "Ana L.",
    location: "Costa del Este",
    rating: 4,
    text: "La lechuga tardó un poco más de lo que esperaba, pero el sabor no se compara con la del súper. Ya voy por mi segundo ciclo con el mismo kit.",
  },
];

export const FAQS = [
  {
    question: "¿Necesito experiencia previa para cultivar?",
    answer:
      "No. Los kits están pensados para principiantes absolutos: la guía incluida te dice qué hacer cada semana, con fotos de referencia para comparar el progreso. Además tienes soporte por WhatsApp las primeras dos semanas.",
  },
  {
    question: "¿Cuánta luz necesita mi kit?",
    answer:
      "Depende del kit: los microverdes crecen con luz indirecta (cualquier ventana), mientras que las aromáticas y hortalizas piden 2 a 4 horas de luz directa. Cada producto indica su requisito exacto en la ficha.",
  },
  {
    question: "¿Qué pasa si mis semillas no germinan?",
    answer:
      "Tienes garantía de germinación de 30 días: si sigues la guía y no ves brotes, te enviamos un repuesto de semillas y sustrato sin costo. Solo escríbenos con una foto de tu kit.",
  },
  {
    question: "¿Hacen envíos fuera de la ciudad de Panamá?",
    answer:
      "Sí, enviamos a todo el país. En ciudad de Panamá y San Miguelito entregamos en 24 h; al interior, en 48–72 h vía courier. El costo se calcula al finalizar la compra y es gratis desde $55.",
  },
  {
    question: "¿Cuánto dura un kit? ¿Puedo reutilizarlo?",
    answer:
      "Cada kit rinde entre 2 y 3 ciclos completos de cultivo. Las macetas y bandejas son reutilizables indefinidamente; cuando se te acaben las semillas y el sustrato, puedes comprar solo el repuesto.",
  },
  {
    question: "¿Cómo pago y qué tan seguro es?",
    answer:
      "El pago se procesa con Stripe, la misma plataforma que usan Amazon y Shopify. Aceptamos tarjetas de crédito y débito. Nunca almacenamos los datos de tu tarjeta en nuestros servidores.",
  },
];

// ============================================================
// Fichas de detalle por producto (HU-006).
// Los tres kits semilla tienen contenido curado; cualquier producto creado
// desde el backoffice recibe una ficha genérica coherente.
// ============================================================

export type ProductExtra = {
  level: string;
  light: string;
  space: string;
  harvest: string;
  cycles: string;
  includes: string[];
  steps: { title: string; text: string }[];
  testimonial: { name: string; text: string };
};

const PRODUCT_EXTRAS: Record<string, ProductExtra> = {
  "kit-balcon-basico": {
    level: "Principiante",
    light: "2–3 h de luz directa",
    space: "Desde 40×40 cm",
    harvest: "21–30 días",
    cycles: "2–3 ciclos por kit",
    includes: [
      "Semillas de lechuga, cilantro y cebollín (3 sobres)",
      "3 macetas compactas con plato de drenaje",
      "Sustrato ligero enriquecido (2 L)",
      "Guía impresa de siembra y riego",
      "Etiquetas para marcar cada cultivo",
      "Acceso al soporte por WhatsApp (2 semanas)",
    ],
    steps: [
      { title: "Prepara las macetas", text: "Llena cada maceta con el sustrato incluido hasta 2 cm del borde." },
      { title: "Siembra por cultivo", text: "Cada sobre indica profundidad y distancia. Marca con las etiquetas." },
      { title: "Riego suave inicial", text: "Humedece sin encharcar y ubica donde reciba 2–3 h de sol." },
      { title: "Cosecha escalonada", text: "La lechuga sale a los 21 días; corta hojas externas y sigue produciendo." },
    ],
    testimonial: {
      name: "Carla M., Bella Vista",
      text: "Mi balcón mide 1 metro y me alcanzó de sobra. El cilantro fue el primero en salir y no he vuelto a comprarlo en el súper.",
    },
  },
  "kit-microverde-rapido": {
    level: "Principiante",
    light: "Luz indirecta (ventana)",
    space: "Desde 30×20 cm",
    harvest: "7–10 días",
    cycles: "4–6 ciclos por kit",
    includes: [
      "Mix de semillas de microverdes (rábano, brócoli, girasol)",
      "2 bandejas de cultivo reutilizables",
      "Sustrato de fibra de coco prensada",
      "Atomizador para riego fino",
      "Guía de cortes y conservación",
      "Acceso al soporte por WhatsApp (2 semanas)",
    ],
    steps: [
      { title: "Hidrata la fibra de coco", text: "Colócala en la bandeja con agua; se expande en minutos." },
      { title: "Siembra denso", text: "Los microverdes se siembran juntos, cubriendo toda la superficie." },
      { title: "Oscuridad 3 días", text: "Tapa la bandeja: la oscuridad inicial fuerza tallos largos y tiernos." },
      { title: "Luz y cosecha", text: "Destapa, riega con el atomizador y corta con tijera entre el día 7 y 10." },
    ],
    testimonial: {
      name: "Diego P., Vía Argentina",
      text: "Lo uso para coronar ensaladas y tostadas. En serio salen en una semana; ya voy por el cuarto ciclo con la misma bandeja.",
    },
  },
  "kit-aromaticas-compacto": {
    level: "Intermedio",
    light: "3–4 h de luz directa",
    space: "Desde 50×30 cm",
    harvest: "30–45 días",
    cycles: "Corte continuo por meses",
    includes: [
      "Semillas de albahaca, menta y perejil",
      "3 macetas de cerámica con autorriego",
      "Sustrato premium con perlita (3 L)",
      "Fertilizante orgánico líquido (100 ml)",
      "Guía de poda para producción continua",
      "Acceso al soporte por WhatsApp (2 semanas)",
    ],
    steps: [
      { title: "Activa el autorriego", text: "Llena el depósito inferior; la cerámica dosifica la humedad sola." },
      { title: "Siembra y germina", text: "La albahaca brota en 5–7 días; la menta y el perejil, en 10–14." },
      { title: "Poda para multiplicar", text: "Corta sobre los nudos: cada poda duplica la producción de hojas." },
      { title: "Fertiliza cada 15 días", text: "Unas gotas del fertilizante incluido mantienen el sabor intenso." },
    ],
    testimonial: {
      name: "Lucía R., Clayton",
      text: "La albahaca no ha parado de producir en tres meses. Cocino con hierbas frescas todos los días y la cocina huele increíble.",
    },
  },
};

export function getProductExtra(product: Product): ProductExtra {
  return (
    PRODUCT_EXTRAS[product.id] ?? {
      level: "Principiante",
      light: "Luz indirecta a moderada",
      space: "Desde 30×30 cm",
      harvest: "14–30 días",
      cycles: "2–3 ciclos por kit",
      includes: [
        "Semillas seleccionadas para ciclo corto",
        "Macetas o bandejas de cultivo",
        "Sustrato listo para sembrar",
        "Guía de siembra y riego paso a paso",
        "Acceso al soporte por WhatsApp (2 semanas)",
      ],
      steps: [
        { title: "Prepara el sustrato", text: "Coloca el sustrato incluido en las macetas del kit." },
        { title: "Siembra las semillas", text: "Sigue la profundidad indicada en la guía impresa." },
        { title: "Riega y da luz", text: "Mantén la humedad y ubica el kit según su requisito de luz." },
        { title: "Cosecha", text: "Corta cuando alcance el tamaño indicado y deja que rebrote." },
      ],
      testimonial: {
        name: "Cliente UrbanSprout",
        text: "Todo llegó completo y la guía hace imposible equivocarse. Repetiría sin dudar.",
      },
    }
  );
}

export const FOOTER = {
  tagline: "Kits de cultivo urbano para cosechar en casa, sin importar el tamaño de tu espacio.",
  contact: {
    email: "hola@urbansprout.com",
    whatsapp: "+507 6000-0000",
    location: "Ciudad de Panamá, Panamá",
  },
};
