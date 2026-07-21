// Diccionario de traducciones del storefront (HU-060).
//
// Vive en el API y no en el frontend porque es la fuente única: el storefront lo
// importa directo (mismo repo, sin red ni build extra) y la tool MCP
// `get_translations` lo sirve por HTTP. Un solo archivo, cero drift.
//
// Módulo puro a propósito: sin imports de Mongo ni de Node, para que el bundler
// del storefront pueda incluirlo tal cual.

export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "es";

export function isLocale(value: string | null | undefined): value is Locale {
  return LOCALES.includes(value as Locale);
}

type Dictionary = Record<string, Record<string, string>>;

const es: Dictionary = {
  nav: {
    brandAria: "Ir al inicio de UrbanSprout",
    panel: "Panel",
    admin: "Admin",
    signIn: "Iniciar sesión",
    clerkMissing: "Configura Clerk para login",
    toLightMode: "Cambiar a modo claro",
    toDarkMode: "Cambiar a modo oscuro",
    lightMode: "Modo claro",
    darkMode: "Modo oscuro",
    language: "Idioma",
  },
  catalog: {
    kicker: "Catálogo",
    title: "Kits para arrancar en una tarde",
    note: "Todos incluyen envío en 24–48 h y garantía de germinación de 30 días.",
    filterLabel: "Filtrar por categoría",
    all: "Todas",
    addToCart: "Agregar al carrito",
    seeDetail: "Ver detalle",
    outOfStock: "Sin stock",
  },
  cart: {
    title: "Tu carrito",
    empty: "Tu carrito está vacío.",
    subtotal: "Subtotal",
    checkout: "Ir a pagar",
    remove: "Quitar",
    undo: "Deshacer",
    freeShipping: "Te faltan {amount} para el envío gratis",
    freeShippingReached: "¡Tienes envío gratis!",
    coupon: "Código de descuento",
    apply: "Aplicar",
  },
  dashboard: {
    title: "Mi cuenta",
    subtitle: "Gestiona tus compras, estados de pago y accesos de UrbanSprout.",
    userType: "Tipo de usuario",
    totalPurchases: "Compras totales",
    activeAccess: "Accesos activos",
    pending: "Pendientes",
    totalPaid: "Total pagado",
    backToCatalog: "Volver al catálogo",
    goToBackoffice: "Ir al backoffice",
    myPurchases: "Mis compras",
    purchasesNote: "Historial completo de órdenes asociadas a tu cuenta.",
    loadingPurchases: "Cargando compras...",
    noPurchasesTitle: "No tienes compras registradas",
    noPurchasesBody: "Cuando compres un kit, aparecerá aquí con su estado y acceso.",
    exploreCatalog: "Explorar catálogo",
    downloadInvoice: "Descargar factura",
    generatingInvoice: "Generando...",
    myAccess: "Mis accesos",
  },
  checkout: {
    successTitle: "¡Pago completado!",
    cancelledTitle: "Pago cancelado",
    retry: "Reintentar la compra",
    backToCatalog: "Volver al catálogo",
    toMyAccount: "Ir a mi cuenta",
  },
  status: {
    pending: "Pendiente",
    paid: "Pagada",
    cancelled: "Cancelada",
    refunded: "Reembolsada",
  },
  errors: {
    notFoundTitle: "Página no encontrada",
    notFoundBody: "Puede que el enlace haya cambiado o que la dirección esté incompleta.",
    backHome: "Volver al inicio",
    offlineTitle: "Sin conexión",
    offlineBody: "Reintentaremos automáticamente cuando vuelva la red.",
    retry: "Reintentar",
  },
};

const en: Dictionary = {
  nav: {
    brandAria: "Go to the UrbanSprout home page",
    panel: "Dashboard",
    admin: "Admin",
    signIn: "Sign in",
    clerkMissing: "Configure Clerk to enable login",
    toLightMode: "Switch to light mode",
    toDarkMode: "Switch to dark mode",
    lightMode: "Light mode",
    darkMode: "Dark mode",
    language: "Language",
  },
  catalog: {
    kicker: "Catalog",
    title: "Kits you can start in one afternoon",
    note: "All of them ship in 24–48 h and include a 30-day germination guarantee.",
    filterLabel: "Filter by category",
    all: "All",
    addToCart: "Add to cart",
    seeDetail: "View details",
    outOfStock: "Out of stock",
  },
  cart: {
    title: "Your cart",
    empty: "Your cart is empty.",
    subtotal: "Subtotal",
    checkout: "Checkout",
    remove: "Remove",
    undo: "Undo",
    freeShipping: "You are {amount} away from free shipping",
    freeShippingReached: "You got free shipping!",
    coupon: "Discount code",
    apply: "Apply",
  },
  dashboard: {
    title: "My account",
    subtitle: "Manage your purchases, payment status and UrbanSprout access.",
    userType: "Account type",
    totalPurchases: "Total purchases",
    activeAccess: "Active access",
    pending: "Pending",
    totalPaid: "Total paid",
    backToCatalog: "Back to catalog",
    goToBackoffice: "Go to backoffice",
    myPurchases: "My purchases",
    purchasesNote: "Full history of orders linked to your account.",
    loadingPurchases: "Loading purchases...",
    noPurchasesTitle: "You have no purchases yet",
    noPurchasesBody: "Once you buy a kit it will show up here with its status and access.",
    exploreCatalog: "Browse catalog",
    downloadInvoice: "Download invoice",
    generatingInvoice: "Generating...",
    myAccess: "My access",
  },
  checkout: {
    successTitle: "Payment complete!",
    cancelledTitle: "Payment cancelled",
    retry: "Try again",
    backToCatalog: "Back to catalog",
    toMyAccount: "Go to my account",
  },
  status: {
    pending: "Pending",
    paid: "Paid",
    cancelled: "Cancelled",
    refunded: "Refunded",
  },
  errors: {
    notFoundTitle: "Page not found",
    notFoundBody: "The link may have changed or the address is incomplete.",
    backHome: "Back to home",
    offlineTitle: "You are offline",
    offlineBody: "We will retry automatically as soon as the network is back.",
    retry: "Retry",
  },
};

export const TRANSLATIONS: Record<Locale, Dictionary> = { es, en };

export const TRANSLATION_SECTIONS = Object.keys(es);

// Devuelve el diccionario completo del locale, o una sección puntual.
// Un locale desconocido cae al default en lugar de fallar: una traducción
// faltante nunca debe romper la página.
export function getTranslations(locale: string, section?: string) {
  const safeLocale: Locale = isLocale(locale) ? locale : DEFAULT_LOCALE;
  const dictionary = TRANSLATIONS[safeLocale];
  if (!section) return { locale: safeLocale, sections: TRANSLATION_SECTIONS, data: dictionary };
  return {
    locale: safeLocale,
    sections: [section],
    data: { [section]: dictionary[section] ?? {} },
  };
}

// Comprueba que ningún locale se quede atrás. Lo usa la prueba unitaria y la
// tool MCP para reportar cobertura.
export function missingTranslationKeys(): { locale: Locale; section: string; key: string }[] {
  const missing: { locale: Locale; section: string; key: string }[] = [];
  for (const [section, entries] of Object.entries(es)) {
    for (const key of Object.keys(entries)) {
      for (const locale of LOCALES) {
        if (!TRANSLATIONS[locale][section]?.[key]) missing.push({ locale, section, key });
      }
    }
  }
  return missing;
}
