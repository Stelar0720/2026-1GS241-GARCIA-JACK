import { createHash } from "node:crypto";
import { resolveRole } from "./auth";

export type RateLimitRule = {
  method: string;
  path: string;
  limit: number;
  windowSeconds: number;
  identity?: string;
};

type Bucket = { count: number; resetAt: number };

const routeKey = (method: string, path: string) => `${method.toUpperCase()} ${path}`;

export class InMemoryRateLimiter {
  private readonly rules = new Map<string, RateLimitRule>();
  private readonly buckets = new Map<string, Bucket>();

  constructor(initialRules: RateLimitRule[] = []) {
    for (const rule of initialRules) this.configure(rule);
  }

  configure(input: RateLimitRule): RateLimitRule {
    const rule = {
      method: input.method.toUpperCase(),
      path: input.path,
      limit: input.limit,
      windowSeconds: input.windowSeconds,
      ...(input.identity ? { identity: input.identity } : {}),
    };
    if (!/^(GET|POST|PATCH|PUT|DELETE)$/.test(rule.method)) throw new Error("Método HTTP inválido.");
    if (!rule.path.startsWith("/")) throw new Error("La ruta debe comenzar con '/'.");
    if (!Number.isInteger(rule.limit) || rule.limit < 1) throw new Error("El límite debe ser un entero positivo.");
    if (!Number.isInteger(rule.windowSeconds) || rule.windowSeconds < 1) throw new Error("La ventana debe ser un entero positivo.");
    const key = `${routeKey(rule.method, rule.path)}:${rule.identity ?? "*"}`;
    this.rules.set(key, rule);
    this.clearBucketsFor(rule.method, rule.path, rule.identity);
    return rule;
  }

  list(): RateLimitRule[] {
    return [...this.rules.values()].sort((a, b) =>
      `${a.method} ${a.path} ${a.identity ?? ""}`.localeCompare(`${b.method} ${b.path} ${b.identity ?? ""}`),
    );
  }

  check(method: string, path: string, identity: string, now = Date.now()): { allowed: boolean; retryAfter: number; limit?: number } {
    if (this.buckets.size > 10_000) {
      for (const [key, bucket] of this.buckets) {
        if (now >= bucket.resetAt) this.buckets.delete(key);
      }
    }
    const base = routeKey(method, path);
    const rule = this.rules.get(`${base}:${identity}`) ?? this.rules.get(`${base}:*`);
    if (!rule) return { allowed: true, retryAfter: 0 };

    const key = `${base}:${identity}`;
    let bucket = this.buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + rule.windowSeconds * 1000 };
      this.buckets.set(key, bucket);
    }
    if (bucket.count >= rule.limit) {
      return { allowed: false, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)), limit: rule.limit };
    }
    bucket.count += 1;
    return { allowed: true, retryAfter: 0, limit: rule.limit };
  }

  private clearBucketsFor(method: string, path: string, identity?: string) {
    const prefix = `${routeKey(method, path)}:`;
    for (const key of this.buckets.keys()) {
      if (key.startsWith(prefix) && (!identity || key === `${prefix}${identity}`)) this.buckets.delete(key);
    }
  }
}

export function requestIdentity(request: Request): string {
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearer && resolveRole(bearer) !== "public") {
    return `auth:${createHash("sha256").update(bearer).digest("hex").slice(0, 24)}`;
  }
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `ip:${forwarded || request.headers.get("x-real-ip") || "unknown"}`;
}

export const rateLimiter = new InMemoryRateLimiter([
  { method: "GET", path: "/products", limit: 100, windowSeconds: 60 },
  { method: "POST", path: "/api/checkout", limit: 10, windowSeconds: 60 },
  { method: "POST", path: "/observability/logs", limit: 30, windowSeconds: 60 },
  { method: "POST", path: "/observability/errors", limit: 10, windowSeconds: 60 },
]);
