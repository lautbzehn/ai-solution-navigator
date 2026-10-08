import { NavLink, useLocation } from 'react-router'
import { BarChart3, BookOpenCheck, FolderKanban, LayoutDashboard, Settings, type LucideIcon } from 'lucide-react'
import { stageDef } from '@/config'
import { useStore } from '@/data/store'
import { CURRENT_USER_ID } from '@/data/seed/people'
import { useUI } from '@/data/ui'
import { cn } from '@/lib/cn'
import { Avatar } from '../ui/Avatar'
import { Tip } from '../ui/Tooltip'
import { Logo } from './Logo'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  badge?: number
  end?: boolean
}

function Item({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate?: () => void }) {
  const link = (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group relative flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-colors duration-150',
          collapsed && 'justify-center px-0',
          isActive ? 'bg-surface-3 font-medium text-fg' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute top-1.5 bottom-1.5 left-0 w-[2px] rounded-full bg-accent" aria-hidden />}
          <item.icon className={cn('size-4 shrink-0', isActive ? 'text-fg' : 'text-fg-subtle group-hover:text-fg-muted')} strokeWidth={1.75} />
          {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
          {!collapsed && item.badge !== undefined && (
            <span className="rounded-full bg-surface-3 px-1.5 text-[10.5px] font-medium text-fg-subtle tabular ring-1 ring-border">{item.badge}</span>
          )}
        </>
      )}
    </NavLink>
  )
  return collapsed ? <Tip content={item.label} side="right">{link}</Tip> : link
}

export function SidebarContent({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const solutions = useStore((s) => s.solutions)
  const me = useStore((s) => s.people.find((p) => p.id === CURRENT_USER_ID))
  const location = useLocation()

  const recent = [...solutions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5)

  const main: NavItem[] = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/solutions', label: 'Solutions', icon: FolderKanban, badge: solutions.length },
    { to: '/reports', label: 'Reports', icon: BarChart3 },
  ]
  const method: NavItem[] = [{ to: '/framework', label: 'Lifecycle Framework', icon: BookOpenCheck }]

  return (
    <div className="flex h-full flex-col">
      <div className={cn('flex h-14 shrink-0 items-center gap-2.5 px-4', collapsed && 'justify-center px-0')}>
        <Logo />
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[13.5px] font-semibold tracking-[-0.01em] text-fg">Solution Navigator</p>
            <p className="truncate text-[11px] text-fg-subtle">Dunder Mifflin · AI Portfolio</p>
          </div>
        )}
      </div>

      <nav aria-label="Primary" className={cn('flex flex-1 flex-col gap-5 overflow-y-auto px-3 pt-2', collapsed && 'px-2')}>
        <div className="flex flex-col gap-0.5">
          {main.map((i) => (
            <Item key={i.to} item={i} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </div>
        <div className="flex flex-col gap-0.5">
          {!collapsed && <p className="px-2.5 pb-1 text-[10.5px] font-semibold tracking-[0.08em] text-fg-faint uppercase">Methodology</p>}
          {method.map((i) => (
            <Item key={i.to} item={i} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </div>
        {!collapsed && (
          <div className="flex flex-col gap-0.5">
            <p className="px-2.5 pb-1 text-[10.5px] font-semibold tracking-[0.08em] text-fg-faint uppercase">Recent</p>
            {recent.map((s) => {
              const active = location.pathname.startsWith(`/solutions/${s.id}`)
              return (
                <NavLink
                  key={s.id}
                  to={`/solutions/${s.id}`}
                  onClick={onNavigate}
                  className={cn(
                    'group flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[12.5px] transition-colors',
                    active ? 'bg-surface-2 text-fg' : 'text-fg-subtle hover:bg-surface-2 hover:text-fg-muted',
                  )}
                >
                  <span className="grid size-4 place-items-center">
                    <span className={cn('size-1.5 rounded-full', active ? 'bg-accent' : 'bg-fg-faint group-hover:bg-fg-subtle')} />
                  </span>
                  <span className="flex-1 truncate">{s.name.replace(/^AI /, '')}</span>
                  <span className="text-[10px] tracking-wide text-fg-faint uppercase">{stageDef(s.stage).name.slice(0, 3)}</span>
                </NavLink>
              )
            })}
          </div>
        )}
      </nav>

      <div className={cn('mt-auto flex flex-col gap-0.5 border-t border-border px-3 py-3', collapsed && 'px-2')}>
        <Item item={{ to: '/settings', label: 'Settings', icon: Settings }} collapsed={collapsed} onNavigate={onNavigate} />
        <div className={cn('mt-2 flex items-center gap-2.5 rounded-lg px-1.5 py-1.5', collapsed && 'justify-center px-0')}>
          <Avatar person={me} size="md" />
          {!collapsed && (
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[12.5px] font-medium text-fg">{me?.name}</p>
              <p className="truncate text-[11px] text-fg-subtle">{me?.title}</p>
            </div>
          )}
          {!collapsed && (
            <Tip content="All people, solutions, and numbers are fictional demo data.">
              <span className="rounded-md bg-warning-soft px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-warning-fg uppercase ring-1 ring-warning/20 ring-inset">Demo</span>
            </Tip>
          )}
        </div>
      </div>
    </div>
  )
}

export function Sidebar() {
  const collapsed = useUI((s) => s.sidebarCollapsed)
  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 border-r border-border bg-bg-subtle transition-[width] duration-300 ease-out md:block',
        collapsed ? 'w-[60px]' : 'w-[244px]',
      )}
    >
      <SidebarContent collapsed={collapsed} />
    </aside>
  )
}
