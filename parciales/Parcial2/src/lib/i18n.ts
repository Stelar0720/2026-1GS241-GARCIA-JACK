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
