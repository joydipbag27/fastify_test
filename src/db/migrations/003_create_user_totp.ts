import { sql } from "kysely";
import type { Migration } from "kysely/migration";

const migration: Migration = {
  up: async (db) => {
    await db.schema
      .createTable("user_totps")
      .addColumn("id", "uuid", (col) =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`),
      )
      .addColumn("user_id", "uuid", (col) =>
        col.notNull().references("users.id").onDelete("cascade").unique(),
      )
      .addColumn("secret", "text", (col) => col.notNull())
      .addColumn("enabled", "boolean", (col) => col.notNull().defaultTo(false))
      .addColumn("verified_at", "timestamp")
      .addColumn("created_at", "timestamp", (col) =>
        col.notNull().defaultTo(sql`now()`),
      )
      .execute();
  },

  down: async (db) => {
    await db.schema.dropTable("user_totps").ifExists().execute();
  },
};

export default migration;
