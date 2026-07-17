import { createHash } from "node:crypto";
import type { Db } from "mongodb";

export function anonymizedUserId(userId: string) {
  return `deleted-${createHash("sha256").update(userId).digest("hex").slice(0, 24)}`;
}

export async function exportUserData(db: Db, userId: string) {
  const [orders, wishlist, reviews, auditLogs, trackedErrors, applicationLogs] = await Promise.all([
    db.collection("orders").find({ buyerId: userId }, { projection: { _id: 0, checkoutSessionId: 0 } }).toArray(),
    db.collection("wishlist").find({ userId }, { projection: { _id: 0 } }).toArray(),
    db.collection("reviews").find({ userId }, { projection: { _id: 0 } }).toArray(),
    db.collection("audit_logs").find({ actor: userId }, { projection: { _id: 0 } }).toArray(),
    db.collection("tracked_errors").find({ userId }, { projection: { _id: 0 } }).toArray(),
    db.collection("application_logs").find({ "context.userId": userId }, { projection: { _id: 0 } }).toArray(),
  ]);
  return { exportedAt: new Date().toISOString(), userId, data: { orders, wishlist, reviews, technicalRecords: { auditLogs, trackedErrors, applicationLogs } } };
}

async function scrubUserFromBackups(db: Db, userId: string, anonymousId: string, now: string) {
  const backups = await db.collection<{ id: string; payload?: string }>("backups").find({ payload: { $type: "string" } }).toArray();
  let changed = 0;
  for (const backup of backups) {
    if (!backup.payload || !backup.payload.includes(userId)) continue;
    const parsed = JSON.parse(backup.payload) as { data?: Record<string, Record<string, unknown>[]> };
    const data = parsed.data ?? {};
    data.orders = (data.orders ?? []).map((row) => row.buyerId === userId ? { ...row, buyerId: anonymousId, buyerEmail: null, anonymizedAt: now } : row);
    data.wishlist = (data.wishlist ?? []).filter((row) => row.userId !== userId);
    data.reviews = (data.reviews ?? []).filter((row) => row.userId !== userId);
    data.audit_logs = (data.audit_logs ?? []).map((row) => row.actor === userId ? { ...row, actor: anonymousId } : row);
    data.tracked_errors = (data.tracked_errors ?? []).map((row) => row.userId === userId ? { ...row, userId: anonymousId } : row);
    data.application_logs = (data.application_logs ?? []).map((row) => {
      const context = row.context as Record<string, unknown> | undefined;
      return context?.userId === userId ? { ...row, context: { ...context, userId: anonymousId } } : row;
    });
    const payload = JSON.stringify(parsed);
    await db.collection("backups").updateOne({ id: backup.id }, { $set: { payload, byteSize: Buffer.byteLength(payload) } });
    changed += 1;
  }
  return changed;
}

export async function deleteUserData(db: Db, userId: string) {
  const anonymousId = anonymizedUserId(userId);
  const now = new Date().toISOString();
  const [orders, wishlist, reviews] = await Promise.all([
    db.collection("orders").updateMany({ buyerId: userId }, { $set: { buyerId: anonymousId, buyerEmail: null, anonymizedAt: now } }),
    db.collection("wishlist").deleteMany({ userId }),
    db.collection("reviews").deleteMany({ userId }),
    db.collection("audit_logs").updateMany({ actor: userId }, { $set: { actor: anonymousId } }),
    db.collection("tracked_errors").updateMany({ userId }, { $set: { userId: anonymousId } }),
    db.collection("application_logs").updateMany({ "context.userId": userId }, { $set: { "context.userId": anonymousId } }),
  ]);
  const scrubbedBackups = await scrubUserFromBackups(db, userId, anonymousId, now);
  return { anonymousId, anonymizedOrders: orders.modifiedCount, deletedWishlistItems: wishlist.deletedCount, deletedReviews: reviews.deletedCount, scrubbedBackups };
}
