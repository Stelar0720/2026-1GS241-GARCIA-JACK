type Level = "info" | "warn" | "error";
function emit(level: Level, message: string, context: Record<string, unknown> = {}) {
  const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";
  const endpoint = level === "error" ? "/observability/errors" : "/observability/logs";
  void fetch(`${apiUrl}${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true, body: JSON.stringify({ level, service: "backoffice", message, route: window.location.pathname, context }) }).catch(() => undefined);
}
export const backofficeLogger = {
  info: (message: string, context?: Record<string, unknown>) => emit("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit("warn", message, context),
  error: (message: string, error: unknown, context: Record<string, unknown> = {}) => { const normalized = error instanceof Error ? { errorMessage: error.message, stack: error.stack } : { errorMessage: String(error) }; emit("error", message, { ...normalized, ...context }); },
};
