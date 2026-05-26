#!/usr/bin/env bun

/**
 * Script para iniciar el servidor API de Checkers
 * Uso: bun run apps/api/start.ts
 */

// polyfill para node
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

// Crear directorio data si no existe
const dataDir = './data';
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// Importar la app
import './index.ts';
