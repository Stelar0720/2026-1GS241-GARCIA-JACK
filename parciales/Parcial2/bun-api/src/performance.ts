// Métricas de rendimiento del API (HU-035): latencia P50/P95/P99 por endpoint,
// tasa de error 4xx/5xx y uptime del proceso.
//
// ponytail: las muestras viven en memoria (ventana deslizante por ruta). Alcanza
// para una sola instancia, que es como está desplegado hoy. Si el API pasa a
// correr replicado, esto tiene que ir a un store compartido (Mongo con TTL o
// Prometheus) o cada réplica reportará solo su propia porción del tráfico.

const MAX_SAMPLES_PER_ROUTE = 500;

export type RouteMetrics = {
  route: string;
  requests: number;
  errors4xx: number;
  errors5xx: number;
  errorRate: number;
  p50: number;
  p95: number;
  p99: number;
  averageMs: number;
  maxMs: number;
};

type RouteBucket = { durations: number[]; requests: number; errors4xx: number; errors5xx: number };

const startedAt = Date.now();
const buckets = new Map<string, RouteBucket>();

// Colapsa los identificadores variables para no explotar la cardinalidad:
// /orders/abc-123/refund -> /orders/:id/refund
export function normalizeRoute(path: string): string {
  return (
    path
      .split("/")
      .map((segment) =>
        segment.length >= 8 && /\d/.test(segment) && /^[A-Za-z0-9._:-]+$/.test(segment) ? ":id" : segment,
      )
      .join("/") || "/"
  );
}

export function percentile(sortedAscending: number[], fraction: number): number {
  if (sortedAscending.length === 0) return 0;
  const index = Math.min(
    sortedAscending.length - 1,
    Math.max(0, Math.ceil(fraction * sortedAscending.length) - 1),
  );
  return Number(sortedAscending[index].toFixed(2));
}

export function recordRequest(input: { method: string; path: string; status: number; durationMs: number }) {
  const route = `${input.method.toUpperCase()} ${normalizeRoute(input.path)}`;
  let bucket = buckets.get(route);
  if (!bucket) {
    bucket = { durations: [], requests: 0, errors4xx: 0, errors5xx: 0 };
    buckets.set(route, bucket);
  }
  bucket.requests += 1;
  if (input.status >= 500) bucket.errors5xx += 1;
  else if (input.status >= 400) bucket.errors4xx += 1;
  bucket.durations.push(input.durationMs);
  if (bucket.durations.length > MAX_SAMPLES_PER_ROUTE) bucket.durations.shift();
}

function summarize(route: string, bucket: RouteBucket): RouteMetrics {
  const sorted = [...bucket.durations].sort((a, b) => a - b);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  const failed = bucket.errors4xx + bucket.errors5xx;
  return {
    route,
    requests: bucket.requests,
    errors4xx: bucket.errors4xx,
    errors5xx: bucket.errors5xx,
    errorRate: bucket.requests ? Number((failed / bucket.requests).toFixed(4)) : 0,
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    averageMs: sorted.length ? Number((total / sorted.length).toFixed(2)) : 0,
    maxMs: sorted.length ? Number(sorted[sorted.length - 1].toFixed(2)) : 0,
  };
}

export function getPerformanceSnapshot(input: { route?: string } = {}) {
  const entries = [...buckets.entries()].filter(([route]) =>
    input.route ? route.toLowerCase().includes(input.route.toLowerCase()) : true,
  );
  const routes = entries.map(([route, bucket]) => summarize(route, bucket)).sort((a, b) => b.requests - a.requests);
  const requests = routes.reduce((sum, route) => sum + route.requests, 0);
  const errors4xx = routes.reduce((sum, route) => sum + route.errors4xx, 0);
  const errors5xx = routes.reduce((sum, route) => sum + route.errors5xx, 0);
  const allDurations = entries.flatMap(([, bucket]) => bucket.durations).sort((a, b) => a - b);
  return {
    uptime: {
      startedAt: new Date(startedAt).toISOString(),
      seconds: Math.round((Date.now() - startedAt) / 1000),
      healthy: errors5xx === 0 || errors5xx / Math.max(requests, 1) < 0.05,
    },
    totals: {
      requests,
      errors4xx,
      errors5xx,
      errorRate: requests ? Number(((errors4xx + errors5xx) / requests).toFixed(4)) : 0,
      p50: percentile(allDurations, 0.5),
      p95: percentile(allDurations, 0.95),
      p99: percentile(allDurations, 0.99),
    },
    routes,
  };
}

export function resetPerformanceMetrics() {
  buckets.clear();
}
