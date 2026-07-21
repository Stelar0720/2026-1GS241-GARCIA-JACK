import { useCallback, useEffect, useState } from "react";
import { getApiErrorMessage, type ApiErrorBody } from "./api-error";

// Dashboard de rendimiento del API (HU-035): latencia por percentil, tasa de
// error 4xx/5xx y uptime con semáforo verde/rojo.

type RouteMetrics = {
  route: string;
  requests: number;
  errors4xx: number;
  errors5xx: number;
  errorRate: number;
  p50: number;
  p95: number;
  p99: number;
  maxMs: number;
};

type Snapshot = {
  uptime: { startedAt: string; seconds: number; healthy: boolean };
  totals: { requests: number; errors4xx: number; errors5xx: number; errorRate: number; p50: number; p95: number; p99: number };
  routes: RouteMetrics[];
};

function formatUptime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
}

export function PerformancePanel({ apiBaseUrl }: { apiBaseUrl: string }) {
  const [adminKey, setAdminKey] = useState(
    () =>
      sessionStorage.getItem("urbansprout-admin-key") ??
      (import.meta.env.VITE_E2E === "true" ? import.meta.env.VITE_E2E_ADMIN_KEY ?? "" : ""),
  );
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!adminKey) return;
    try {
      const response = await fetch(`${apiBaseUrl}/observability/performance`, {
        headers: { Authorization: `Bearer ${adminKey}` },
      });
      const body = (await response.json().catch(() => null)) as ({ data?: Snapshot } & ApiErrorBody) | null;
      if (!response.ok) throw new Error(getApiErrorMessage(body, "No se pudieron cargar las métricas."));
      setSnapshot(body?.data ?? null);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron cargar las métricas.");
    }
  }, [adminKey, apiBaseUrl]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const refresh = () => setAdminKey(sessionStorage.getItem("urbansprout-admin-key") ?? "");
    window.addEventListener("urbansprout-admin-key", refresh);
    return () => window.removeEventListener("urbansprout-admin-key", refresh);
  }, []);

  return (
    <section className="panel stack" aria-labelledby="performance-title">
      <div className="section-header">
        <div>
          <h2 id="performance-title">Rendimiento del API</h2>
          <p>Latencia por percentil, tasa de error y disponibilidad en vivo.</p>
        </div>
        <button className="button button-outline" type="button" onClick={() => void load()}>
          Actualizar
        </button>
      </div>

      {message ? (
        <p className="status-message" role="status">
          {message}
        </p>
      ) : null}

      {snapshot ? (
        <>
          <div className="perf-summary">
            <div>
              <span>Uptime</span>
              <strong>
                <em className={snapshot.uptime.healthy ? "perf-dot perf-ok" : "perf-dot perf-down"} aria-hidden="true" />
                {snapshot.uptime.healthy ? "Saludable" : "Degradado"}
              </strong>
              <small>{formatUptime(snapshot.uptime.seconds)}</small>
            </div>
            <div>
              <span>Solicitudes</span>
              <strong>{snapshot.totals.requests}</strong>
              <small>
                {snapshot.totals.errors4xx} · 4xx / {snapshot.totals.errors5xx} · 5xx
              </small>
            </div>
            <div>
              <span>Tasa de error</span>
              <strong>{(snapshot.totals.errorRate * 100).toFixed(1)}%</strong>
            </div>
            <div>
              <span>Latencia global</span>
              <strong>{snapshot.totals.p95} ms</strong>
              <small>
                P50 {snapshot.totals.p50} · P99 {snapshot.totals.p99}
              </small>
            </div>
          </div>

          <div className="table perf-table">
            <div className="table-row table-head">
              <span>Endpoint</span>
              <span>Req.</span>
              <span>P50</span>
              <span>P95</span>
              <span>P99</span>
              <span>Errores</span>
            </div>
            {snapshot.routes.slice(0, 12).map((route) => (
              <div className="table-row" key={route.route}>
                <code>{route.route}</code>
                <span>{route.requests}</span>
                <span>{route.p50} ms</span>
                <span>{route.p95} ms</span>
                <span>{route.p99} ms</span>
                <span className={route.errors5xx > 0 ? "perf-down" : undefined}>
                  {route.errors4xx + route.errors5xx} ({(route.errorRate * 100).toFixed(0)}%)
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="meta">Ingresa la clave administrativa para ver las métricas.</p>
      )}
    </section>
  );
}
