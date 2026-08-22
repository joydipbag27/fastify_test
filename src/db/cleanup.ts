import { db } from "./index.js";
import createUsers from "./migrations/001_create_users.js";
import createSessions from "./migrations/002_create_sessions.js";
import createTotps from "./migrations/003_create_user_totp.js";
import createChallenges from "./migrations/004_create_challenge.js";
import createPasskeys from "./migrations/005_create_passkeys.js";

await createTotps.down!(db);
await createSessions.down!(db);
await createPasskeys.down!(db);
await createChallenges.down!(db);
await createUsers.down!(db);

await db.destroy();
