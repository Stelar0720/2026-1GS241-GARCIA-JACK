// Identidad de la versión desplegada.
//
// Por qué existe: el paso "Wait for Railway" del CD solo hacía `curl /health`.
// La instancia vieja también responde 200 a /health, así que el pipeline daba
// verde aunque el build nuevo hubiera fallado o siguiera en cola. Un despliegue
// que no se puede distinguir del anterior no está verificado.
//
// ponytail: el commit se escribe en `src/COMMIT` desde el CD antes de subir el
// código. Va dentro de `src/` a propósito: el Dockerfile del API hace
// `COPY src/ ./src/` y nada más, así que un archivo en la raíz del servicio
// nunca llegaría a la imagen.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { apiConfig } from "./config";

function readCommit(): string {
  const fromEnv = process.env.APP_COMMIT?.trim() || process.env.RAILWAY_GIT_COMMIT_SHA?.trim();
  if (fromEnv) return fromEnv;
  for (const candidate of [join(import.meta.dir, "COMMIT"), join(process.cwd(), "src", "COMMIT")]) {
    if (existsSync(candidate)) {
      const value = readFileSync(candidate, "utf8").trim();
      if (value) return value;
    }
  }
  return "desconocido";
}

const commit = readCommit();
const startedAt = new Date().toISOString();

export function versionInfo() {
  return {
    commit,
    short: commit.slice(0, 7),
    environment: apiConfig.environment,
    startedAt,
  };
}
