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
 * TLS options for hosted Postgres (Heroku, RDS, etc.). Local/compose hosts
 * stay plaintext; remote hosts require TLS. Certificate verification is
 * skipped because platform CAs are often not in the public trust store.
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
 * Create a Drizzle database client from a connection string.
 * This is a pure factory function with no runtime-specific dependencies.
 */
export function createDb(connectionString: string, options?: CreateDbOptions): Database {
  const sql = postgres(connectionString, {
    max: options?.max ?? 10,
    prepare: options?.prepare ?? true,
    idle_timeout: options?.idleTimeout ?? 20,
    ssl: postgresSsl(connectionString),
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
