import { describe, expect, test } from "bun:test";
import { configuredBackupCollections } from "./data-ops";

describe("data operations", () => {
  test("uses safe configurable backup collections without internal collections", () => {
    expect(configuredBackupCollections("products,orders,backups,schema_migrations,$bad,products")).toEqual(["products", "orders"]);
  });

  test("ships a useful Mongo application backup by default", () => {
    expect(configuredBackupCollections(undefined)).toEqual(expect.arrayContaining(["products", "orders", "wishlist", "reviews"]));
  });
});
