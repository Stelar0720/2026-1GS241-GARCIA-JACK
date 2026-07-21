import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  LOCALES,
  LOCALE_LABELS,
  LOCALE_STORAGE_KEY,
  LocaleContext,
  resolveInitialLocale,
  translate,
  useLocale,
  type Locale,
  type LocaleContextValue,
} from "@/lib/i18n";

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(resolveInitialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    document.documentElement.lang = next;
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, t: (path, replacements) => translate(locale, path, replacements) }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function LanguageSelector() {
  const { locale, setLocale, t } = useLocale();
  // Solo `aria-label`: envolverlo además en un <label> con texto le daría al
  // select dos nombres accesibles y aXe lo reporta como violación.
  return (
    <div className="language-selector">
      <select
        aria-label={t("nav.language")}
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
      >
        {LOCALES.map((item) => (
          <option key={item} value={item}>
            {LOCALE_LABELS[item]}
          </option>
        ))}
      </select>
    </div>
  );
}
