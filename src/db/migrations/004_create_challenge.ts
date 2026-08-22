import { sql } from "kysely";
import type { Migration } from "kysely/migration";

const migration: Migration = {
  up: async (db) => {
    await db.schema
      .createTable("challenges")
      .addColumn("id", "uuid", (col) =>
        col
          .primaryKey()
          .notNull()
          .unique()
          .defaultTo(sql`gen_random_uuid()`),
      )
      .addColumn("user_id", "uuid", (col) =>
        col.notNull().references("users.id").onDelete("cascade"),
      )
      .addColumn("challenge", "text", (col) => col.notNull().unique())
      .addColumn("expires_at", "timestamp", (col) => col.defaultTo(sql`now()`).notNull())
      .execute();
  },

  down: async (db) => {
    await db.schema.dropTable("challenges").ifExists().execute()
  },
};

export default migration;
