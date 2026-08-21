import type { Generated } from "kysely";

export interface Database {
  users: {
    id: Generated<string>;
    name: string;
    password: string;
    email: string;
    created_at: Generated<Date>;
  };
  sessions: {
    id: Generated<string>;
    user_id: string;
    expires_at: Date;
    created_at: Generated<Date>;
  };
  user_totps : {
    id: Generated<string>,
    user_id: string,
    secret: string,
    enabled: boolean,
    verified_at: Date | null,
    created_at: Generated<Date>,
  }
}
