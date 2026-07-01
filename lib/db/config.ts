import type { PoolConfig } from "pg";

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required.");
  return url;
}

function isLocalDatabase(url: string): boolean {
  const hostname = new URL(url).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function sslMode(url: string): string | null {
  return new URL(url).searchParams.get("sslmode");
}

export function databasePoolConfig(): PoolConfig {
  const connectionString = databaseUrl();
  const explicitSsl = process.env.DATABASE_SSL?.toLowerCase();
  const ssl =
    explicitSsl === "false" || sslMode(connectionString) === "disable"
      ? false
      : explicitSsl === "true" || sslMode(connectionString) === "require" || !isLocalDatabase(connectionString)
        ? { rejectUnauthorized: false }
        : false;

  return {
    connectionString,
    ssl,
    keepAlive: true,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: Number(process.env.DATABASE_IDLE_TIMEOUT_MS ?? 20_000),
    connectionTimeoutMillis: Number(process.env.DATABASE_CONNECTION_TIMEOUT_MS ?? 10_000),
  };
}

export function databaseCredentials() {
  const config = databasePoolConfig();
  return {
    url: config.connectionString!,
    ssl: config.ssl,
  };
}
