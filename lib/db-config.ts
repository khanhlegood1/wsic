import type { PoolConfig } from "pg";

/**
 * Shared Postgres config for better-auth and the /api/health/auth diagnostics.
 * SSL is on by default; set POSTGRES_SSL=false for databases without SSL.
 */
export const pgConfig: PoolConfig = {
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT
    ? parseInt(process.env.POSTGRES_PORT, 10)
    : 5432,
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: process.env.POSTGRES_SSL === "false" ? false : true,
};
