import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { Db } from "mongodb";

export const INTEGRATION_PERMISSIONS = ["catalog:read", "orders:read", "reports:read"] as const;
export type IntegrationPermission = typeof INTEGRATION_PERMISSIONS[number];

export type ApiKeyRecord = {
  id: string;
  name: string;
  prefix: string;
  secretHash: string;
  permissions: IntegrationPermission[];
  expiresAt: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  rotatedFromId: string | null;
};

export type PublicApiKey = Omit<ApiKeyRecord, "secretHash">;

export function hashApiKey(secret: string) {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

export function generateApiKey() {
  const id = randomUUID();
  const token = `usk_${id.replaceAll("-", "").slice(0, 12)}_${randomBytes(24).toString("base64url")}`;
  return { id, token, prefix: token.slice(0, 20) };
}

export function apiKeyHashMatches(secret: string, expectedHash: string) {
  const actual = Buffer.from(hashApiKey(secret), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function isApiKeyUsable(key: Pick<ApiKeyRecord, "expiresAt" | "revokedAt">, now = new Date()) {
  return !key.revokedAt && (!key.expiresAt || new Date(key.expiresAt).getTime() > now.getTime());
}

function publicKey(key: ApiKeyRecord & { _id?: unknown }): PublicApiKey {
  const { secretHash: _secretHash, _id: _id, ...safe } = key;
  return safe;
}

export async function initializeApiKeys(db: Db) {
  await db.collection<ApiKeyRecord>("api_keys").createIndex({ prefix: 1 }, { unique: true });
  await db.collection<ApiKeyRecord>("api_keys").createIndex({ createdAt: -1 });
}

export async function createApiKey(db: Db, input: { name: string; permissions: IntegrationPermission[]; expiresAt?: string | null; rotatedFromId?: string | null }) {
  const generated = generateApiKey();
  const record: ApiKeyRecord = {
    id: generated.id,
    name: input.name.trim(),
    prefix: generated.prefix,
    secretHash: hashApiKey(generated.token),
    permissions: [...new Set(input.permissions)],
    expiresAt: input.expiresAt ?? null,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    revokedAt: null,
    rotatedFromId: input.rotatedFromId ?? null,
  };
  await db.collection<ApiKeyRecord>("api_keys").insertOne(record);
  return { apiKey: publicKey(record), token: generated.token };
}

export async function listApiKeys(db: Db) {
  const rows = await db.collection<ApiKeyRecord>("api_keys").find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray();
  return rows.map(publicKey);
}

export async function authenticateApiKey(db: Db, token: string, permission?: IntegrationPermission) {
  const prefix = token.slice(0, 20);
  const key = await db.collection<ApiKeyRecord>("api_keys").findOne({ prefix });
  if (!key || !apiKeyHashMatches(token, key.secretHash) || !isApiKeyUsable(key) || (permission && !key.permissions.includes(permission))) return null;
  await db.collection<ApiKeyRecord>("api_keys").updateOne({ id: key.id }, { $set: { lastUsedAt: new Date().toISOString() } });
  return publicKey(key);
}

export async function revokeApiKey(db: Db, id: string) {
  const result = await db.collection<ApiKeyRecord>("api_keys").updateOne({ id, revokedAt: null }, { $set: { revokedAt: new Date().toISOString() } });
  return result.modifiedCount === 1;
}

export async function rotateApiKey(db: Db, id: string) {
  const revokedAt = new Date().toISOString();
  const previous = await db.collection<ApiKeyRecord>("api_keys").findOneAndUpdate({ id, revokedAt: null }, { $set: { revokedAt } }, { returnDocument: "before" });
  if (!previous) return null;
  const replacement = await createApiKey(db, { name: previous.name, permissions: previous.permissions, expiresAt: previous.expiresAt, rotatedFromId: previous.id });
  return replacement;
}
