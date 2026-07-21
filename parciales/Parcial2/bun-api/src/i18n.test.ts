import { describe, expect, test } from "bun:test";
import { DEFAULT_LOCALE, LOCALES, TRANSLATIONS, getTranslations, isLocale, missingTranslationKeys } from "./i18n";

describe("traducciones del storefront (HU-060)", () => {
  test("soporta español e inglés con cobertura completa", () => {
    expect(LOCALES).toEqual(["es", "en"]);
    // CA-164: ninguna clave puede quedarse sin traducir en ningún locale.
    expect(missingTranslationKeys()).toEqual([]);
  });

  test("las dos versiones tienen exactamente las mismas secciones y claves", () => {
    for (const section of Object.keys(TRANSLATIONS.es)) {
      expect(Object.keys(TRANSLATIONS.en[section]).sort()).toEqual(Object.keys(TRANSLATIONS.es[section]).sort());
    }
  });

  test("las cadenas en inglés son realmente distintas de las españolas", () => {
    // Detecta el copy-paste sin traducir: al menos el 90% debe diferir.
    const pairs = Object.entries(TRANSLATIONS.es).flatMap(([section, entries]) =>
      Object.entries(entries).map(([key, value]) => [value, TRANSLATIONS.en[section][key]] as const),
    );
    const translated = pairs.filter(([spanish, english]) => spanish !== english);
    expect(translated.length / pairs.length).toBeGreaterThan(0.9);
  });

  test("un locale desconocido cae al idioma por defecto en vez de fallar", () => {
    expect(isLocale("fr")).toBe(false);
    expect(getTranslations("fr").locale).toBe(DEFAULT_LOCALE);
    expect(getTranslations("").locale).toBe(DEFAULT_LOCALE);
  });

  test("puede pedirse una sección puntual", () => {
    const result = getTranslations("en", "nav");
    expect(result.sections).toEqual(["nav"]);
    expect(Object.keys(result.data)).toEqual(["nav"]);
    expect(result.data.nav.signIn).toBe("Sign in");
    // Una sección inexistente devuelve vacío, no undefined.
    expect(getTranslations("en", "inexistente").data.inexistente).toEqual({});
  });
});
