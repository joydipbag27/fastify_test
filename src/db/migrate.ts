import { db } from "./index.js";
import createUsers from "./migrations/001_create_users.js";
import createSessions from "./migrations/002_create_sessions.js";
import createTotps from "./migrations/003_create_user_totp.js";
import createChallenges from "./migrations/004_create_challenge.js";

await createUsers.up(db);
await createSessions.up(db);
await createTotps.up(db);
await createChallenges.up(db);

await db.destroy();
