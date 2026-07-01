import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { databasePoolConfig } from "./config";
import * as schema from "./schema";

const pool = new Pool(databasePoolConfig());

pool.on("error", (error) => {
  console.error("[db] idle postgres client error", error);
});

export const db = drizzle({ client: pool, schema });
export type DB = typeof db;
