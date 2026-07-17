export type LogContext = Record<string, unknown>;

export interface AppLogger {
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error: unknown, context?: LogContext): void;
}

function send(level: "info" | "warn" | "error", message: string, context: LogContext) {
  const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";
  const endpoint = level === "error" ? "/observability/errors" : "/observability/logs";
  void fetch(`${apiUrl}${endpoint}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
    body: JSON.stringify({ level, service: "storefront", message, route: window.location.pathname, context }),
  }).catch(() => undefined);
}

export const logger: AppLogger = {
  info(message, context = {}) { console.info(message, context); send("info", message, context); },
  warn(message, context = {}) { console.warn(message, context); send("warn", message, context); },
  error(message, error, context = {}) {
    console.error(message, { error, ...context });
    const normalized = error instanceof Error ? { errorMessage: error.message, stack: error.stack } : { errorMessage: String(error) };
    send("error", message, { ...normalized, ...context });
  },
};
