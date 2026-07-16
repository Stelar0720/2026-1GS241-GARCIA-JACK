type EnvironmentSource = Record<string, string | undefined>;

export function validateMcpEnvironment(source: EnvironmentSource = process.env) {
  const environment = (source.APP_ENV || source.RAILWAY_ENVIRONMENT_NAME || source.NODE_ENV || "development").toLowerCase();
  const deployed = environment === "staging" || environment === "production";
  const missing = deployed ? ["API_URL", "MCP_API_KEY"].filter((name) => !source[name]?.trim()) : [];
  if (missing.length > 0) throw new Error(`[config] Faltan variables del MCP para ${environment}: ${missing.join(", ")}`);
  const apiUrl = source.API_URL?.trim() || "http://localhost:4000";
  try { new URL(apiUrl); } catch { throw new Error("[config] API_URL debe ser una URL válida."); }
  return { apiUrl, apiKey: source.MCP_API_KEY?.trim() || "" };
}

export const mcpConfig = validateMcpEnvironment();
