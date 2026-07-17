import { createHash, randomUUID } from "node:crypto";
import type { Db, Document } from "mongodb";

export type MigrationRecord = {
  version: number; name: string; checksum: string; appliedAt: string;
};

export type BackupRecord = {
  id: string; createdAt: string; reason: "manual" | "daily"; collections: string[];
  documentCount: number; byteSize: number; payload?: string;
};

type Migration = {
  version: number;
  name: string;
  up: (db: Db) => Promise<void>;
  down: (db: Db) => Promise<void>;
};

const migrations: Migration[] = [
  {
    version: 1,
    name: "normalize-product-taxonomy",
    up: async (db) => {
      await db.collection("products").updateMany(
        { category: { $exists: false } },
        { $set: { category: "Sin categoria", tags: [] } },
      );
    },
    down: async (db) => { await db.collection("products").updateMany({ category: "Sin categoria" }, { $unset: { category: "", tags: "" } }); },
  },
  {
    version: 2,
    name: "mark-schema-version",
    up: async (db) => { await db.collection("products").updateMany({}, { $set: { schemaVersion: 2 } }); },
    down: async (db) => { await db.collection("products").updateMany({}, { $unset: { schemaVersion: "" } }); },
  },
];

function checksum(migration: Migration) {
  return createHash("sha256").update(`${migration.version}:${migration.name}:${migration.up.toString()}:${migration.down.toString()}`).digest("hex");
}

export function configuredBackupCollections(envValue = process.env.BACKUP_COLLECTIONS) {
  const defaults = ["products", "inventory", "orders", "coupons", "reviews", "wishlist", "admin_users", "api_keys", "processed_stripe_events", "audit_logs", "application_logs", "tracked_errors"];
  const requested = envValue?.split(",").map((item) => item.trim()).filter(Boolean) ?? defaults;
  return [...new Set(requested)].filter((name) => /^[a-z][a-z0-9_]{1,62}$/i.test(name) && !["backups", "schema_migrations"].includes(name));
}

export async function migrationStatus(db: Db) {
  const applied = await db.collection<MigrationRecord>("schema_migrations").find({}, { projection: { _id: 0 } }).sort({ version: 1 }).toArray();
  const appliedVersions = new Set(applied.map((item) => item.version));
  return migrations.map((migration) => ({ version: migration.version, name: migration.name, checksum: checksum(migration), applied: appliedVersions.has(migration.version) }));
}

export async function migrateUp(db: Db) {
  const collection = db.collection<MigrationRecord>("schema_migrations");
  const locks = db.collection("schema_migration_locks");
  await collection.createIndex({ version: 1 }, { unique: true });
  const applied = new Map((await collection.find({}).toArray()).map((item) => [item.version, item]));
  const executed: number[] = [];
  for (const migration of migrations) {
    const existing = applied.get(migration.version);
    const expected = checksum(migration);
    if (existing && existing.checksum !== expected) throw new Error(`Checksum invalido para migracion ${migration.version}`);
    if (existing) continue;
    let ownsLock = false;
    try {
      await locks.insertOne({ version: migration.version, acquiredAt: new Date().toISOString() });
      ownsLock = true;
    } catch (error) {
      if (!(typeof error === "object" && error !== null && "code" in error && error.code === 11000)) throw error;
    }
    if (!ownsLock) {
      for (let attempt = 0; attempt < 100; attempt += 1) {
        if (await collection.findOne({ version: migration.version })) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (!await collection.findOne({ version: migration.version })) throw new Error(`Timeout esperando migracion concurrente ${migration.version}`);
      continue;
    }
    try {
      await migration.up(db);
      await collection.insertOne({ version: migration.version, name: migration.name, checksum: expected, appliedAt: new Date().toISOString() });
      executed.push(migration.version);
    } finally {
      await locks.deleteOne({ version: migration.version });
    }
  }
  return { executed, status: await migrationStatus(db) };
}

export async function rollbackLatestMigration(db: Db, confirmation: string) {
  if (confirmation !== "ROLLBACK_LATEST") throw new Error("Se requiere confirmacion ROLLBACK_LATEST");
  const collection = db.collection<MigrationRecord>("schema_migrations");
  const latest = await collection.findOne({}, { sort: { version: -1 } });
  if (!latest) return { rolledBack: null };
  const migration = migrations.find((item) => item.version === latest.version);
  if (!migration) throw new Error(`No existe rollback para migracion ${latest.version}`);
  await migration.down(db);
  await collection.deleteOne({ version: latest.version });
  return { rolledBack: latest.version, status: await migrationStatus(db) };
}

export async function createBackup(db: Db, reason: BackupRecord["reason"] = "manual") {
  const collections = configuredBackupCollections();
  const data: Record<string, Document[]> = {};
  let documentCount = 0;
  for (const name of collections) {
    data[name] = await db.collection(name).find({}).toArray();
    documentCount += data[name].length;
  }
  const payload = JSON.stringify({ format: "urbansprout-mongodb-backup-v1", createdAt: new Date().toISOString(), data });
  const maxBytes = Math.max(1024, Number(process.env.BACKUP_MAX_BYTES) || 12_000_000);
  if (Buffer.byteLength(payload) > maxBytes) throw new Error(`Backup excede limite configurable de ${maxBytes} bytes`);
  const record: BackupRecord = { id: randomUUID(), createdAt: new Date().toISOString(), reason, collections, documentCount, byteSize: Buffer.byteLength(payload), payload };
  await db.collection<BackupRecord>("backups").insertOne(record);
  const retention = Math.max(1, Math.min(Number(process.env.BACKUP_RETENTION) || 7, 30));
  const expired = await db.collection<BackupRecord>("backups").find({}, { projection: { id: 1 } }).sort({ createdAt: -1 }).skip(retention).toArray();
  if (expired.length) await db.collection("backups").deleteMany({ id: { $in: expired.map((item) => item.id) } });
  return { ...record, payload: undefined };
}

export async function listBackups(db: Db) {
  return db.collection<BackupRecord>("backups").find({}, { projection: { _id: 0, payload: 0 } }).sort({ createdAt: -1 }).toArray();
}

export async function restoreBackup(db: Db, id: string, confirmation: string) {
  if (confirmation !== `RESTORE:${id}`) throw new Error(`Se requiere confirmacion RESTORE:${id}`);
  const backup = await db.collection<BackupRecord>("backups").findOne({ id });
  if (!backup?.payload) return null;
  const parsed = JSON.parse(backup.payload) as { format: string; data: Record<string, Document[]> };
  if (parsed.format !== "urbansprout-mongodb-backup-v1") throw new Error("Formato de backup no soportado");
  const allowed = new Set(configuredBackupCollections());
  for (const [name, documents] of Object.entries(parsed.data)) if (!allowed.has(name) || !Array.isArray(documents)) throw new Error(`Coleccion no permitida en backup: ${name}`);
  const session = db.client.startSession();
  try {
    await session.withTransaction(async () => {
      for (const [name, documents] of Object.entries(parsed.data)) {
        await db.collection(name).deleteMany({}, { session });
        if (documents.length) await db.collection(name).insertMany(documents, { session });
      }
    });
  } finally { await session.endSession(); }
  return { id, restoredAt: new Date().toISOString(), collections: Object.keys(parsed.data) };
}

export function scheduleDailyBackups(db: Db) {
  if (process.env.BACKUP_DAILY_ENABLED === "false" || process.env.NODE_ENV === "test") return null;
  const interval = setInterval(async () => {
    try {
      const latest = await db.collection<BackupRecord>("backups").findOne({}, { sort: { createdAt: -1 } });
      if (latest && Date.now() - Date.parse(latest.createdAt) < 23 * 60 * 60 * 1000) return;
      const day = new Date().toISOString().slice(0, 10);
      try { await db.collection("backup_daily_locks").insertOne({ _id: day as never, acquiredAt: new Date().toISOString() }); }
      catch (error) { if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) return; throw error; }
      await createBackup(db, "daily");
    } catch (error) { console.error("[backup] No se pudo crear el backup diario", error); }
  }, 60 * 60 * 1000);
  interval.unref?.();
  return interval;
}
