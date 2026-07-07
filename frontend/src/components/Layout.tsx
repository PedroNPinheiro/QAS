import {
  BarChart3,
  BellRing,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Moon,
  ScrollText,
  Sun,
  Users,
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth'
import { EXTERNAL_LINKS, SECTIONS } from '../modules'
import type { SectionKey } from '../modules'
import { TEAM_LABELS, hasFullAccess, visibleModules } from '../permissions'
import { useTheme } from '../theme'

const ORDER: SectionKey[] = ['quality', 'security', 'environment']

function NavItem({
  to,
  icon: Icon,
  label,
  end,
}: {
  to: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  end?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
          isActive
            ? 'bg-surface font-medium text-accent-dark shadow-sm ring-1 ring-ink/10'
            : 'text-ink-secondary hover:bg-ink/5 hover:text-ink'
        }`
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </NavLink>
  )
}

export default function Layout() {
  const { user, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const full = hasFullAccess(user)
  const modules = visibleModules(user)
  const sections = ORDER.filter((key) => modules.some((m) => m.section === key))

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 flex w-64 flex-col border-r border-hairline bg-surface">
        <div className="flex items-center gap-3 px-5 pb-5 pt-6">
          <img src="/casco-mark.png" alt="CASCO Pet" className="h-9 w-9 rounded-lg" />
          <div>
            <div className="text-base font-semibold leading-tight">QAS</div>
            <div className="text-[11px] leading-tight text-ink-muted">
              Quality · Safety · Environment
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          {full && (
            <div className="space-y-0.5">
              <NavItem to="/" icon={LayoutDashboard} label="Dashboard" end />
              <NavItem to="/analytics" icon={BarChart3} label="Analytics" />
            </div>
          )}
          {sections.map((key) => (
            <div
              key={key}
              className="rounded-xl p-1.5"
              style={{ backgroundColor: SECTIONS[key].soft }}
            >
              <div className="mb-1 px-2 pt-1">
                <span
                  className="text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: SECTIONS[key].text }}
                >
                  {SECTIONS[key].label}
                </span>
              </div>
              <div className="space-y-0.5">
                {modules.filter((m) => m.section === key).map((m) => (
                  <NavItem key={m.path} to={m.path} icon={m.icon} label={m.navLabel} />
                ))}
                {full && EXTERNAL_LINKS[key].map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-secondary transition-colors hover:bg-ink/5 hover:text-ink"
                  >
                    <ExternalLink className="h-4 w-4 shrink-0" />
                    <span className="truncate">{link.label}</span>
                  </a>
                ))}
              </div>
            </div>
          ))}
          {user?.role === 'admin' && (
            <div>
              <div className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                Administration
              </div>
              <div className="space-y-0.5">
                <NavItem to="/users" icon={Users} label="Users" />
                <NavItem to="/notifications" icon={BellRing} label="Notifications" />
                <NavItem to="/audit" icon={ScrollText} label="Audit Log" />
              </div>
            </div>
          )}
        </nav>

        <div className="border-t border-hairline p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{user?.full_name}</div>
              <div className="truncate text-xs text-ink-muted">
                {user ? `${TEAM_LABELS[user.team] ?? user.team} · ` : ''}
                {user?.email}
              </div>
            </div>
            <div className="flex shrink-0 items-center">
              <button
                onClick={toggle}
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-ink/5 hover:text-ink"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <button
                onClick={logout}
                title="Sign out"
                className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-ink/5 hover:text-ink"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="ml-64 flex-1">
        <div className="mx-auto max-w-[88rem] px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
