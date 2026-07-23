import { createContext, useContext } from "react";
import { DEFAULT_LOCALE, LOCALES, TRANSLATIONS, isLocale, type Locale } from "../../bun-api/src/i18n";

// Selector de idioma del storefront (HU-060).
//
// El diccionario se importa del API (mismo repo, módulo puro): una sola fuente
// para la UI y para la tool MCP `get_translations`. No hay fetch en el arranque,
// así que cambiar de idioma es instantáneo y funciona sin conexión.
//
// Los componentes viven en `@/components/locale`; acá solo estado y helpers.

export { LOCALES, type Locale };

export const LOCALE_STORAGE_KEY = "urbansprout-locale";

export const LOCALE_LABELS: Record<Locale, string> = { es: "Español", en: "English" };

// Preferencia guardada, o español.
//
// A propósito NO se mira `navigator.language`: UrbanSprout vende en Panamá y el
// idioma del sitio es una decisión de negocio, no del navegador. Además hace el
// primer render determinístico, que es lo que necesitan las pruebas E2E.
export function resolveInitialLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return isLocale(stored) ? stored : DEFAULT_LOCALE;
}

export type Translate = (path: string, replacements?: Record<string, string | number>) => string;

export type LocaleContextValue = { locale: Locale; setLocale: (next: Locale) => void; t: Translate };

export const LocaleContext = createContext<LocaleContextValue | null>(null);

// "cart.freeShipping" -> texto, con {placeholders} reemplazados.
// Si falta la clave devuelve la del locale por defecto y, si tampoco está, el
// propio path: una traducción incompleta degrada, nunca rompe la página.
export function translate(locale: Locale, path: string, replacements?: Record<string, string | number>) {
  const [section, key] = path.split(".");
  const value = TRANSLATIONS[locale][section]?.[key] ?? TRANSLATIONS[DEFAULT_LOCALE][section]?.[key] ?? path;
  if (!replacements) return value;
  return Object.entries(replacements).reduce(
    (text, [name, replacement]) => text.replaceAll(`{${name}}`, String(replacement)),
    value,
  );
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  // Fuera del provider (tests de componentes aislados) se responde en español.
  if (!context) {
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => undefined,
      t: (path, replacements) => translate(DEFAULT_LOCALE, path, replacements),
    };
  }
  return context;
}

const PAYMENT_METHOD_TRANSLATIONS: Record<Locale, Record<string, string>> = {
  es: {
    sessionExpired: "Tu sesión expiró. Inicia sesión nuevamente.",
    unavailable: "Los pagos guardados no están habilitados en este entorno.",
    manageError: "No se pudieron gestionar tus métodos de pago.",
    title: "Métodos de pago guardados",
    description:
      "Guarda una tarjeta para comprar más rápido. UrbanSprout solo almacena la marca y los últimos 4 dígitos; el número completo vive en Stripe.",
    loading: "Cargando tus tarjetas...",
    empty: "Todavía no tienes tarjetas guardadas.",
    expires: "vence",
    remove: "Eliminar",
    removeConfirm: "¿Eliminar esta tarjeta guardada?",
    removed: "Tarjeta eliminada.",
    removeError: "No se pudo eliminar la tarjeta.",
    add: "Guardar una tarjeta",
    preparing: "Preparando...",
    cardTitle: "Datos de la tarjeta",
    save: "Guardar tarjeta",
    saving: "Guardando...",
    cancel: "Cancelar",
    invalidIntent: "Stripe no devolvió un intento de configuración válido.",
    startError: "No se pudo iniciar el guardado de tarjeta.",
    saved: "Tarjeta guardada correctamente.",
    configMissing: "Configura la clave pública de Stripe para guardar tarjetas.",
    confirmError: "No se pudo guardar la tarjeta. Revisa los datos e inténtalo nuevamente.",
  },
  en: {
    sessionExpired: "Your session expired. Please sign in again.",
    unavailable: "Saved payments are not enabled in this environment.",
    manageError: "We could not manage your payment methods.",
    title: "Saved payment methods",
    description:
      "Save a card for faster checkout. UrbanSprout only stores its brand and last 4 digits; the full number remains in Stripe.",
    loading: "Loading your cards...",
    empty: "You do not have any saved cards yet.",
    expires: "expires",
    remove: "Remove",
    removeConfirm: "Remove this saved card?",
    removed: "Card removed.",
    removeError: "We could not remove the card.",
    add: "Save a card",
    preparing: "Preparing...",
    cardTitle: "Card details",
    save: "Save card",
    saving: "Saving...",
    cancel: "Cancel",
    invalidIntent: "Stripe did not return a valid setup intent.",
    startError: "We could not start saving the card.",
    saved: "Card saved successfully.",
    configMissing: "Configure the Stripe publishable key to save cards.",
    confirmError: "We could not save the card. Check the details and try again.",
  },
};

export function translatePaymentMethod(locale: Locale, key: string) {
  return PAYMENT_METHOD_TRANSLATIONS[locale][key] ?? PAYMENT_METHOD_TRANSLATIONS[DEFAULT_LOCALE][key] ?? key;
}
