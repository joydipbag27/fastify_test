import { db } from "./index.js";
import createUsers from "./migrations/001_create_users.js";
import createSessions from "./migrations/002_create_sessions.js";

await createUsers.up(db);
await createSessions.up(db);

await db.destroy();
