// Mirrors backend/app/permissions.py — the API enforces all of this
// server-side; the frontend only adapts what it shows.
import type { User } from './auth'
import { MODULES } from './modules'
import type { ModuleDef } from './modules'

const MODULE_TEAMS: Record<string, string[]> = {
  internal_nc: ['quality'],
  external_nc: ['quality', 'purchasing', 'warehouse'],
  accident: ['quality'],
  near_miss: ['quality'],
  waste: ['quality'],
}

const TEAM_EDITABLE_FIELDS: Record<string, Record<string, string[]>> = {
  external_nc: {
    purchasing: ['communicated_date', 'supplier_response', 'root_cause', 'action_to_take'],
    warehouse: ['return_note', 'closure_responsible', 'closure_date', 'notes', 'status'],
  },
}

export const hasFullAccess = (user: User | null) =>
  user !== null && (user.role === 'admin' || user.team === 'quality')

export const canViewModule = (user: User | null, module: ModuleDef) =>
  user !== null &&
  (user.role === 'admin' || MODULE_TEAMS[module.entityType]?.includes(user.team))

export const canCreate = (user: User | null) => hasFullAccess(user)

/** Fields the user may edit on this module — null means all fields. */
export function editableFields(user: User | null, module: ModuleDef): string[] | null {
  if (hasFullAccess(user)) return null
  if (!user) return []
  return TEAM_EDITABLE_FIELDS[module.entityType]?.[user.team] ?? []
}

export const visibleModules = (user: User | null) =>
  MODULES.filter((m) => canViewModule(user, m))

/** Landing page: restricted teams go straight to External NCs. */
export const homePath = (user: User | null) =>
  hasFullAccess(user) ? '/' : '/quality/external-nc'

export const TEAM_LABELS: Record<string, string> = {
  quality: 'Quality',
  purchasing: 'Purchasing',
  warehouse: 'Warehouse',
}
