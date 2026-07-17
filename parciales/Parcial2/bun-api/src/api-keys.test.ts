import { describe, expect, test } from "bun:test";
import { apiKeyHashMatches, generateApiKey, hashApiKey, isApiKeyUsable } from "./api-keys";
import { anonymizedUserId } from "./privacy";

describe("API keys and GDPR", () => {
  test("hashes, verifies and expires secrets", () => {
    const key = generateApiKey();
    expect(key.token.startsWith("usk_")).toBe(true);
    expect(apiKeyHashMatches(key.token, hashApiKey(key.token))).toBe(true);
    expect(apiKeyHashMatches(`${key.token}x`, hashApiKey(key.token))).toBe(false);
    expect(isApiKeyUsable({ revokedAt: null, expiresAt: null })).toBe(true);
    expect(isApiKeyUsable({ revokedAt: "now", expiresAt: null })).toBe(false);
    expect(isApiKeyUsable({ revokedAt: null, expiresAt: "2020-01-01T00:00:00.000Z" })).toBe(false);
  });
  test("anonymizes deterministically", () => {
    expect(anonymizedUserId("user_123")).toBe(anonymizedUserId("user_123"));
    expect(anonymizedUserId("user_123")).not.toContain("user_123");
  });
});
