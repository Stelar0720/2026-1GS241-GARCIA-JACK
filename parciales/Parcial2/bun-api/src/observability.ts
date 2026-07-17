import { createHash, randomUUID } from "node:crypto";
import type { Collection, Filter } from "mongodb";
import { db, dbReady } from "./db";

export type LogLevel = "info" | "warn" | "error";
export type ServiceName = "api" | "storefront" | "backoffice" | "mcp";
export type StructuredLog = { id: string; timestamp: Date; level: LogLevel; service: ServiceName; message: string; context: Record<string, unknown> };
export type TrackedError = { id: string; fingerprint: string; status: "open" | "resolved"; service: ServiceName; message: string; stack: string | null; route: string | null; userId: string | null; action: string | null; context: Record<string, unknown>; occurrences: number; firstSeenAt: string; lastSeenAt: string; resolvedAt: string | null };

let logs: Collection<StructuredLog>;
let errors: Collection<TrackedError>;
const SECRET_KEY = /token|authorization|cookie|password|secret|api[-_]?key|card/i;

export function sanitizeContext(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (typeof value === "string") return value.slice(0, 2_000);
  if (value == null || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 25).map((item) => sanitizeContext(item, depth + 1));
  if (typeof value !== "object") return String(value).slice(0, 2_000);
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 50).map(([key, item]) => [key, SECRET_KEY.test(key) ? "[redacted]" : sanitizeContext(item, depth + 1)]));
}

export function errorFingerprint(service: string, message: string, stack?: string | null) {
  const topFrame = stack?.split("\n").find((line) => line.trim().startsWith("at ")) ?? "";
  return createHash("sha256").update(`${service}|${message}|${topFrame}`).digest("hex").slice(0, 24);
}

export async function initializeObservability() {
  await dbReady;
  logs = db.collection<StructuredLog>("application_logs"); errors = db.collection<TrackedError>("tracked_errors");
  await Promise.all([logs.createIndex({ service: 1, level: 1, timestamp: -1 }), logs.createIndex({ timestamp: 1 }, { expireAfterSeconds: 2_592_000 }), errors.createIndex({ fingerprint: 1 }, { unique: true }), errors.createIndex({ status: 1, lastSeenAt: -1 })]);
}

function safeContext(context: unknown) { const clean = sanitizeContext(context); return clean && typeof clean === "object" && !Array.isArray(clean) ? clean as Record<string, unknown> : {}; }

export async function writeLog(input: { level: LogLevel; service: ServiceName; message: string; context?: unknown }) {
  const entry: StructuredLog = { id: randomUUID(), timestamp: new Date(), level: input.level, service: input.service, message: input.message.slice(0, 1_000), context: safeContext(input.context) };
  console[input.level](JSON.stringify(entry)); await logs.insertOne(entry); return entry;
}
export async function queryLogs(input: { service?: ServiceName; level?: LogLevel; from?: string; to?: string; limit?: number }) {
  const filter: Filter<StructuredLog> = {}; if (input.service) filter.service = input.service; if (input.level) filter.level = input.level;
  if (input.from || input.to) filter.timestamp = { ...(input.from ? { $gte: new Date(input.from) } : {}), ...(input.to ? { $lte: new Date(input.to) } : {}) };
  return logs.find(filter, { projection: { _id: 0 } }).sort({ timestamp: -1 }).limit(Math.min(Math.max(input.limit ?? 100, 1), 500)).toArray();
}
export async function captureError(input: { service: ServiceName; message: string; stack?: string | null; route?: string | null; userId?: string | null; action?: string | null; context?: unknown }) {
  const now = new Date().toISOString(); const fingerprint = errorFingerprint(input.service, input.message, input.stack);
  await errors.updateOne({ fingerprint }, { $set: { status: "open", service: input.service, message: input.message.slice(0, 1_000), stack: input.stack?.slice(0, 12_000) ?? null, route: input.route?.slice(0, 500) ?? null, userId: input.userId?.slice(0, 200) ?? null, action: input.action?.slice(0, 500) ?? null, context: safeContext(input.context), lastSeenAt: now, resolvedAt: null }, $setOnInsert: { id: randomUUID(), fingerprint, firstSeenAt: now }, $inc: { occurrences: 1 } }, { upsert: true });
  await writeLog({ level: "error", service: input.service, message: input.message, context: { fingerprint, route: input.route, userId: input.userId, action: input.action } });
  return errors.findOne({ fingerprint }, { projection: { _id: 0 } });
}
export async function getErrorFeed(input: { status?: "open" | "resolved"; service?: ServiceName; limit?: number }) { const filter: Filter<TrackedError> = {}; if (input.status) filter.status = input.status; if (input.service) filter.service = input.service; return errors.find(filter, { projection: { _id: 0 } }).sort({ lastSeenAt: -1 }).limit(Math.min(Math.max(input.limit ?? 50, 1), 200)).toArray(); }
export async function resolveError(fingerprint: string) { return errors.findOneAndUpdate({ fingerprint }, { $set: { status: "resolved", resolvedAt: new Date().toISOString() } }, { returnDocument: "after", projection: { _id: 0 } }); }
