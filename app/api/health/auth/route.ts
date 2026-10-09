import { NextResponse } from "next/server";
import { Pool } from "pg";
import { pgConfig } from "@/lib/db-config";

export const dynamic = "force-dynamic";

const ENV_KEYS = [
  "POSTGRES_HOST",
  "POSTGRES_PORT",
  "POSTGRES_DATABASE",
  "POSTGRES_USER",
  "POSTGRES_PASSWORD",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "NEXT_PUBLIC_BASE_URL",
  "NEXT_PUBLIC_CONVEX_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
] as const;

const HINTS: Record<string, string> = {
  ECONNREFUSED: "Cannot reach the database host/port (check POSTGRES_HOST / POSTGRES_PORT).",
  ENOTFOUND: "Database host not found (check POSTGRES_HOST).",
  ETIMEDOUT: "Database connection timed out (firewall / IP allow-list?).",
  "28P01": "Wrong database user or password.",
  "28000": "Database rejected the user (check POSTGRES_USER).",
  "3D000": "Database name does not exist (check POSTGRES_DATABASE).",
  "42P01": "Auth tables are missing: run better-auth_migrations/*.sql.",
};

/**
 * Safe diagnostics for auth setup: only booleans and error codes,
 * never values of secrets. Remove this route once login works.
 */
export async function GET() {
  const env = Object.fromEntries(
    ENV_KEYS.map((k) => [k, Boolean(process.env[k])])
  );

  const db: Record<string, unknown> = {
    ssl: pgConfig.ssl !== false,
    connected: false,
  };

  const pool = new Pool({ ...pgConfig, connectionTimeoutMillis: 8000 });
  try {
    await pool.query("select 1");
    db.connected = true;

    const tables = await pool.query(
      `select table_name from information_schema.tables
       where table_schema = 'public' and table_name in ('user','session','account','verification')`
    );
    const found = tables.rows.map((r) => r.table_name as string);
    db.tables = {
      user: found.includes("user"),
      session: found.includes("session"),
      account: found.includes("account"),
      verification: found.includes("verification"),
    };

    const col = await pool.query(
      `select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'user' and column_name = 'isAnonymous'`
    );
    db.hasIsAnonymousColumn = (col.rowCount ?? 0) > 0;
  } catch (e) {
    const code = (e as { code?: string }).code ?? "UNKNOWN";
    db.errorCode = code;
    db.hint =
      HINTS[code] ??
      (String((e as Error).message).includes("SSL")
        ? "SSL mismatch: try POSTGRES_SSL=false (no SSL) or enable SSL on the database."
        : "See Vercel runtime logs for details.");
  } finally {
    await pool.end().catch(() => undefined);
  }

  // POSTGRES_PORT is optional (defaults to 5432).
  const missing = ENV_KEYS.filter((k) => !env[k] && k !== "POSTGRES_PORT");
  return NextResponse.json({ env, missing, db });
}
