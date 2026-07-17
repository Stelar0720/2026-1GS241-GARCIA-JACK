import { describe, expect, test } from "bun:test";
import { InMemoryRateLimiter, requestIdentity } from "./rate-limit";

describe("InMemoryRateLimiter", () => {
  test("aplica límites distintos por ruta e identidad", () => {
    const limiter = new InMemoryRateLimiter([{ method: "GET", path: "/products", limit: 2, windowSeconds: 60 }]);
    expect(limiter.check("GET", "/products", "ip:a", 1).allowed).toBe(true);
    expect(limiter.check("GET", "/products", "ip:a", 2).allowed).toBe(true);
    expect(limiter.check("GET", "/products", "ip:a", 3)).toEqual({ allowed: false, retryAfter: 60, limit: 2 });
    expect(limiter.check("GET", "/products", "ip:b", 3).allowed).toBe(true);
    expect(limiter.check("GET", "/other", "ip:a", 3).allowed).toBe(true);
  });

  test("una regla de usuario reemplaza la regla general y se actualiza en runtime", () => {
    const limiter = new InMemoryRateLimiter([{ method: "POST", path: "/checkout", limit: 10, windowSeconds: 60 }]);
    limiter.configure({ method: "POST", path: "/checkout", identity: "auth:vip", limit: 1, windowSeconds: 30 });
    expect(limiter.check("POST", "/checkout", "auth:vip", 100).allowed).toBe(true);
    expect(limiter.check("POST", "/checkout", "auth:vip", 101).retryAfter).toBe(30);
    limiter.configure({ method: "POST", path: "/checkout", identity: "auth:vip", limit: 2, windowSeconds: 10 });
    expect(limiter.check("POST", "/checkout", "auth:vip", 102).allowed).toBe(true);
    expect(limiter.list()).toHaveLength(2);
  });

  test("un bearer falso no crea identidades nuevas y usa la IP", () => {
    const first = requestIdentity(new Request("http://local", { headers: { Authorization: "Bearer secreto" } }));
    const second = requestIdentity(new Request("http://local", { headers: { Authorization: "Bearer secreto" } }));
    expect(first).toBe(second);
    expect(first).toBe("ip:unknown");
    expect(first).not.toContain("secreto");
    expect(requestIdentity(new Request("http://local", { headers: { "x-forwarded-for": "203.0.113.4, 10.0.0.1" } }))).toBe("ip:203.0.113.4");
  });
});
