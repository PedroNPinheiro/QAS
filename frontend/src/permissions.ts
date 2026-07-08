// Mirrors backend/app/permissions.py — the API enforces all of this
// server-side; the frontend only adapts what it shows.
import type { User } from './auth'
import { MODULES } from './modules'
import type { ModuleDef } from './modules'

const MODULE_TEAMS: Record<string, string[]> = {
  internal_nc: ['quality', 'viewer', 'internal_nc_viewer'],
  external_nc: ['quality', 'purchasing', 'warehouse', 'viewer'],
  test_report: ['quality', 'viewer'],
  accident: ['quality', 'viewer'],
  near_miss: ['quality', 'viewer'],
  waste: ['quality', 'viewer', 'waste_viewer'],
}

const READ_ONLY_TEAMS = ['viewer', 'internal_nc_viewer', 'waste_viewer']

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

/** Dashboard & analytics: full access or the all-modules viewer. */
export const canSeeDashboards = (user: User | null) =>
  hasFullAccess(user) || user?.team === 'viewer'

/** Uploading/removing files counts as editing — read-only teams may not. */
export const canModifyFiles = (user: User | null, module: ModuleDef) =>
  canViewModule(user, module) &&
  (user?.role === 'admin' || !READ_ONLY_TEAMS.includes(user?.team ?? ''))

/** Landing page: dashboard when allowed, else the first visible module. */
export const homePath = (user: User | null) =>
  canSeeDashboards(user) ? '/' : visibleModules(user)[0]?.path ?? '/'

export const TEAM_LABELS: Record<string, string> = {
  quality: 'Quality',
  purchasing: 'Purchasing',
  warehouse: 'Warehouse',
  viewer: 'Viewer',
  internal_nc_viewer: 'Internal NCs viewer',
  waste_viewer: 'Waste viewer',
}
