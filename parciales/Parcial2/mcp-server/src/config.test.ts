import { describe, expect, test } from "bun:test";
import { validateMcpEnvironment } from "./config";

describe("MCP config", () => {
  test("mantiene separado el JWT del cliente de la API key de rol", () => {
    const config = validateMcpEnvironment({
      NODE_ENV: "development",
      API_URL: "https://api.example.test",
      MCP_API_KEY: " admin-key ",
      MCP_USER_TOKEN: " clerk-jwt ",
    });

    expect(config).toEqual({
      apiUrl: "https://api.example.test",
      apiKey: "admin-key",
      userToken: "clerk-jwt",
    });
  });

  test("el token de usuario es opcional para tools no personales", () => {
    expect(validateMcpEnvironment({ NODE_ENV: "development" }).userToken).toBe("");
  });
});
