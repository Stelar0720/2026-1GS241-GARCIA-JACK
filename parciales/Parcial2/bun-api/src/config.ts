export type AppEnvironment = "development" | "staging" | "production" | "test";

type EnvironmentSource = Record<string, string | undefined>;

function appEnvironment(source: EnvironmentSource): AppEnvironment {
  const raw = (source.APP_ENV || source.RAILWAY_ENVIRONMENT_NAME || source.NODE_ENV || "development")
    .trim()
    .toLowerCase();
  if (raw === "prod" || raw === "production") return "production";
  if (raw === "stage" || raw === "staging") return "staging";
  if (raw === "test") return "test";
  return "development";
}

function required(source: EnvironmentSource, names: string[]) {
  return names.filter((name) => !source[name]?.trim());
}

function assertUrl(name: string, value: string) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
  } catch {
    throw new Error(`[config] ${name} debe ser una URL http(s) válida.`);
  }
}

export function validateApiEnvironment(source: EnvironmentSource = process.env) {
  const environment = appEnvironment(source);
  const deployed = environment === "staging" || environment === "production";
  const requiredNames = deployed
    ? [
        "MONGODB_URI",
        "MONGODB_DATABASE",
        "ALLOWED_ORIGINS",
        "APP_URL",
        "STRIPE_SECRET_KEY",
        "STRIPE_WEBHOOK_SECRET",
        "MCP_ADMIN_KEY",
        "MCP_SUPPORT_KEY",
        "MCP_CLIENT_KEY",
        "MCP_CI_KEY",
        "CLERK_SECRET_KEY",
      ]
    : [];
  const missing = required(source, requiredNames);
  if (missing.length > 0) {
    throw new Error(`[config] Faltan variables requeridas para ${environment}: ${missing.join(", ")}`);
  }

  const appUrl = source.APP_URL?.trim();
  if (appUrl) assertUrl("APP_URL", appUrl);
  for (const origin of (source.ALLOWED_ORIGINS || "").split(",").map((item) => item.trim()).filter(Boolean)) {
    assertUrl("ALLOWED_ORIGINS", origin);
  }
  const port = Number(source.PORT || source.API_PORT || 4000);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("[config] PORT/API_PORT debe ser un puerto válido.");
  }

  return {
    environment,
    port,
    mongoUri: source.MONGODB_URI?.trim() || "mongodb://127.0.0.1:27017",
    mongoDatabase: source.MONGODB_DATABASE?.trim() || "urbansprout",
    allowedOrigins: (source.ALLOWED_ORIGINS || "http://localhost:3000,http://localhost:5173")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    appUrl: appUrl || "http://localhost:3000",
    clerkSecretKey: source.CLERK_SECRET_KEY?.trim() || "",
  };
}

export const apiConfig = validateApiEnvironment();
