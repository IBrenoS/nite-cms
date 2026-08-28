import "server-only";

import { Pool, neonConfig } from "@neondatabase/serverless";
import * as cmsSchema from "@nite/content/admin";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import WebSocket from "ws";

neonConfig.webSocketConstructor = WebSocket;

let pool: Pool | undefined;
let database: NeonDatabase<typeof cmsSchema> | undefined;

export function getCmsDatabase(configuration: { databaseUrl: string }) {
  if (!database) {
    pool = new Pool({ connectionString: configuration.databaseUrl });
    const createdDatabase = drizzle(pool, { schema: cmsSchema });
    database = createdDatabase;
    return createdDatabase;
  }

  return database;
}
