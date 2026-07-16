import { describe, expect, test } from "bun:test";
import { validateApiEnvironment } from "./config";

const production = {
  APP_ENV: "production",
  MONGODB_URI: "mongodb://mongo:27017",
  MONGODB_DATABASE: "urbansprout",
  ALLOWED_ORIGINS: "https://app.example.com,https://admin.example.com",
  APP_URL: "https://app.example.com",
  STRIPE_SECRET_KEY: "sk_test_value",
  STRIPE_WEBHOOK_SECRET: "whsec_value",
  MCP_ADMIN_KEY: "admin-value",
  MCP_SUPPORT_KEY: "support-value",
  MCP_CLIENT_KEY: "client-value",
  MCP_CI_KEY: "ci-value",
};

describe("validateApiEnvironment", () => {
  test("mantiene defaults seguros para desarrollo", () => {
    const config = validateApiEnvironment({ APP_ENV: "development" });
    expect(config.mongoDatabase).toBe("urbansprout");
    expect(config.port).toBe(4000);
  });

  test("falla temprano si falta un secret en producción", () => {
    expect(() => validateApiEnvironment({ ...production, MCP_ADMIN_KEY: "" })).toThrow(
      "MCP_ADMIN_KEY",
    );
  });

  test("acepta una configuración desplegada completa", () => {
    const config = validateApiEnvironment(production);
    expect(config.environment).toBe("production");
    expect(config.allowedOrigins).toHaveLength(2);
  });
});
