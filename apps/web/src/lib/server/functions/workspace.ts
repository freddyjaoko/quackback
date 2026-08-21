/**
 * Server-only workspace helpers.
 *
 * These are not RPC endpoints. They used to be `createServerFn`, but nested
 * calls from other server functions (e.g. checkOnboardingState → getSettings)
 * go through the production hash registry — and helpers that are only referenced
 * from extracted handler bodies are omitted from that registry. The workspace
 * onboarding step then crashed with "Server function info not found".
 * `createServerOnlyFn` keeps a direct in-process call on the server.
 */

import { createServerOnlyFn } from '@tanstack/react-start'
import type { Role } from '@/lib/shared/roles'
import { db, principal, eq } from '@/lib/server/db'
import { getSession } from '@/lib/server/auth/session'
import { logger } from '@/lib/server/logger'

const log = logger.child({ component: 'workspace' })

/**
 * Get the app settings.
 *
 * Returns the RAW settings row: JSON config columns (featureFlags, authConfig,
 * portalConfig, ...) come back as unparsed text. For parsed, default-merged
 * reads use the settings domain service (getTenantSettings / isFeatureEnabled)
 * instead of casting a column off this row.
 */
export const getSettings = createServerOnlyFn(async () => {
  const org = await db.query.settings.findFirst()
  return org ?? null
})

/**
 * Get current user's role if logged in
 */
export const getCurrentUserRole = createServerOnlyFn(async (): Promise<Role | null> => {
  log.debug('get current user role')
  const session = await getSession()
  if (!session?.user) {
    log.debug('no session')
    return null
  }

  const principalRecord = await db.query.principal.findFirst({
    where: eq(principal.userId, session.user.id),
  })

  if (!principalRecord) {
    log.debug('no principal')
    return null
  }
  log.debug({ role: principalRecord.role }, 'current user role')
  return principalRecord.role as Role
})

/**
 * Validate API workspace access
 */
export const validateApiWorkspaceAccess = createServerOnlyFn(async () => {
  const session = await getSession()
  if (!session?.user) {
    return { success: false as const, error: 'Unauthorized', status: 401 as const }
  }

  const [principalRecord, appSettings] = await Promise.all([
    db.query.principal.findFirst({
      where: eq(principal.userId, session.user.id),
    }),
    db.query.settings.findFirst(),
  ])

  if (!principalRecord) {
    return { success: false as const, error: 'Forbidden', status: 403 as const }
  }

  if (!appSettings) {
    return { success: false as const, error: 'Settings not found', status: 403 as const }
  }

  return {
    success: true as const,
    settings: appSettings,
    principal: principalRecord,
    user: session.user,
  }
})

export type ApiWorkspaceResult = Awaited<ReturnType<typeof validateApiWorkspaceAccess>>
