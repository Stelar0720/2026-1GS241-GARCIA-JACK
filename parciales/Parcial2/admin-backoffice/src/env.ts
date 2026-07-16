function value(name: string) {
  return (import.meta.env as Record<string, string | undefined>)[name]?.trim();
}

export function validateBackofficeEnvironment() {
  if (import.meta.env.VITE_E2E === "true" || !import.meta.env.PROD) return;
  const required = ["VITE_API_URL", "VITE_STOREFRONT_URL", "VITE_CLERK_PUBLISHABLE_KEY"];
  const missing = required.filter((name) => !value(name));
  if (missing.length > 0) {
    throw new Error(`[config] Faltan variables del backoffice: ${missing.join(", ")}`);
  }
}
