import { describe, expect, test } from "bun:test";
import { errorFingerprint, sanitizeContext } from "./observability";
describe("observability", () => {
  test("redacts secrets recursively and bounds strings", () => { expect(sanitizeContext({ token: "abc", nested: { password: "no", ok: "yes" } })).toEqual({ token: "[redacted]", nested: { password: "[redacted]", ok: "yes" } }); expect(sanitizeContext("x".repeat(3000))).toHaveLength(2000); });
  test("groups equivalent errors with a stable fingerprint", () => { const stack = "Error: boom\n    at render (App.tsx:10:2)"; expect(errorFingerprint("storefront", "boom", stack)).toBe(errorFingerprint("storefront", "boom", stack)); expect(errorFingerprint("api", "boom", stack)).not.toBe(errorFingerprint("storefront", "boom", stack)); });
});
