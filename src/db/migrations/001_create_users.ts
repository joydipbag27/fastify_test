import { Kysely, sql } from "kysely";
import type { Migration } from "kysely/migration";

const migration: Migration = {
  up: async (db: Kysely<unknown>) => {
    await db.schema
      .createTable("users")
      .addColumn("id", "uuid", (col) =>
        col.primaryKey().defaultTo(sql`gen_random_uuid()`),
      )
      .addColumn("name", "varchar(150)", (col) => col.notNull())
      .addColumn("password", "text", (col) => col.notNull())
      .addColumn("email", "varchar(150)", (col) => col.notNull().unique())
      .addColumn("created_at", "timestamp", (col) =>
        col.notNull().defaultTo(sql`now()`),
      )
      .execute();
  },

  down: async (db: Kysely<unknown>) => {
    await db.schema.dropTable("users").execute();
  },
};

export default migration