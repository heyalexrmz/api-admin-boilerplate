import { defineConfig } from "drizzle-kit";
import { databaseCredentials } from "./lib/db/config";

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema/*.ts",
  out: "./lib/db/migrations",
  dbCredentials: databaseCredentials(),
});
