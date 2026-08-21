import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export type Database = PostgresJsDatabase<typeof schema>

export interface CreateDbOptions {
  /** Maximum number of connections (default: 10) */
  max?: number
  /** Disable prepared statements (required for some connection poolers) */
  prepare?: boolean
  /** Close idle connections after this many seconds (default: 20). */
  idleTimeout?: number
}

/**
 * TLS options for hosted Postgres. Local/compose hosts stay plaintext;
 * remote hosts require TLS. Certificate verification is skipped because
 * platform CAs are often not in the public trust store.
 */
export function postgresSsl(connectionString: string): { rejectUnauthorized: boolean } | undefined {
  let host: string
  try {
    host = new URL(connectionString).hostname
  } catch {
    return undefined
  }
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === 'postgres' ||
    host === 'db'
  ) {
    return undefined
  }
  return { rejectUnauthorized: false }
}

/**
 * Some managed Postgres providers reject CREATE EXTENSION when pg_temp is
 * implicitly first in current_schemas() — which happens after any TEMP
 * object is created. Pinning pg_temp last keeps CREATE EXTENSION legal.
 * This is also PostgreSQL's default plus an explicit pg_temp, so it is
 * safe on local/compose.
 */
export const POSTGRES_SESSION_PARAMS = {
  search_path: '"$user", public, pg_temp',
} as const

export async function pinExtensionSearchPath(sql: ReturnType<typeof postgres>): Promise<void> {
  await sql.unsafe('SET search_path TO "$user", public, pg_temp')
}

/**
 * Create a Drizzle database client from a connection string.
 * This is a pure factory function with no runtime-specific dependencies.
 */
export function createDb(connectionString: string, options?: CreateDbOptions): Database {
  const sql = postgres(connectionString, {
    max: options?.max ?? 10,
    prepare: options?.prepare ?? true,
    idle_timeout: options?.idleTimeout ?? 20,
    ssl: postgresSsl(connectionString),
    connection: POSTGRES_SESSION_PARAMS,
  })
  return drizzle(sql, { schema })
}

/**
 * Create a database client for migrations.
 * Uses DATABASE_URL directly, only works in Node.js.
 */
export function getMigrationDb(): Database {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required for migrations')
  }
  return createDb(connectionString, { max: 1 })
}
