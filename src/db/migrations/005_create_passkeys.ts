import type { Migration } from "kysely/migration";

const migration: Migration = {
  up: async (db) => {
    await db.schema
      .createTable("passkeys")
      .addColumn("user_id", "uuid", (col) =>
        col.notNull().references("users.id").onDelete("cascade"),
      )
      .addColumn("credential_id", "text", (col) => col.notNull().unique())
      .addColumn("public_key", "text", (col) => col.notNull())
      .addColumn("counter", "integer", (col) => col.notNull().defaultTo(0))
      .execute();
  },
  down: async (db) => {
    await db.schema.dropTable("passkeys").ifExists().execute();
  },
};


export default migration