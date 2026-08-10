import { sql } from "kysely";
import type { Migration } from "kysely/migration";

const migration: Migration = {
  up: async (db) => {
    await db.schema
      .createTable("sessions")
      .addColumn("id", "uuid", (col) =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`),
      )
      .addColumn("user_id", "uuid", (col) =>
        col.notNull().references("users.id").onDelete("cascade"),
      )
      .addColumn("expires_at", "timestamp", (col) => col.notNull())
      .addColumn("created_at", "timestamp", (col) =>
        col.notNull().defaultTo(sql`now()`),
      )
      .execute();
  },

  down: async (db) => {
    await db.schema.dropTable("sessions").execute();
  },
};

export default migration;
