import { Link, NavLink, useLocation, useMatch, type Location } from 'react-router'
import { BarChart3, BookOpenCheck, FolderKanban, LayoutDashboard, Settings, type LucideIcon } from 'lucide-react'
import { stageDef } from '@/config'
import { usePortfolio } from '@/data/hooks'
import { useStore } from '@/data/store'
import { CURRENT_USER_ID } from '@/data/seed/people'
import { useUI } from '@/data/ui'
import { cn } from '@/lib/cn'
import { Avatar } from '../ui/Avatar'
import { Tip } from '../ui/Tooltip'
import { ForgeMark } from '../brand/ForgeMark'
import { Logo } from './Logo'

interface SubItem {
  label: string
  to: string
  active: (l: Location) => boolean
  badge?: number
  tone?: 'danger'
}

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** One-line description shown on hover. */
  hint: string
  badge?: number
  end?: boolean
  /** Sub-categories, shown while this page is open. */
  subs?: SubItem[]
}

const atHash = (id: string, ...aliases: string[]) => (l: Location) => [id, ...aliases].includes(decodeURIComponent(l.hash.slice(1)))

function Item({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate?: () => void }) {
  const location = useLocation()
  const match = useMatch({ path: item.to, end: !!item.end })
  const showSubs = !collapsed && !!match && !!item.subs?.length
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
  return (
    <div>
      <Tip content={collapsed ? <><b className="font-semibold">{item.label}</b> · {item.hint}</> : item.hint} side="right" delay={collapsed ? undefined : 600}>
        {link}
      </Tip>
      {showSubs && (
        <ul className="mt-0.5 mb-1 ml-[17px] grid animate-fade-in gap-px border-l border-border pl-2" aria-label={`${item.label} sections`}>
          {item.subs!.map((sub) => {
            const active = sub.active(location)
            return (
              <li key={sub.label}>
                <Link
                  to={sub.to}
                  onClick={onNavigate}
                  aria-current={active ? 'location' : undefined}
                  className={cn(
                    'flex h-7 items-center gap-2 rounded-md px-2 text-[12.5px] transition-colors',
                    active ? 'bg-surface-2 font-medium text-fg' : 'text-fg-subtle hover:bg-surface-2 hover:text-fg-muted',
                  )}
                >
                  <span className="flex-1 truncate">{sub.label}</span>
                  {sub.badge !== undefined && sub.badge > 0 && (
                    <span className={cn('rounded-full px-1.5 text-[10.5px] font-medium tabular', sub.tone === 'danger' ? 'bg-danger-soft text-danger-fg' : 'bg-surface-3 text-fg-subtle')}>{sub.badge}</span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function SidebarContent({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const solutions = useStore((s) => s.solutions)
  const me = useStore((s) => s.people.find((p) => p.id === CURRENT_USER_ID))
  const location = useLocation()
  const attention = usePortfolio().filter((i) => i.health.status !== 'on_track').length

  const recent = [...solutions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5)
  const search = (l: Location) => new URLSearchParams(l.search)

  const main: NavItem[] = [
    {
      to: '/',
      label: 'Dashboard',
      icon: LayoutDashboard,
      end: true,
      hint: 'Portfolio status at a glance, and what needs attention',
      subs: [
        { label: 'Needs attention', to: '/#attention', active: atHash('attention'), badge: attention, tone: 'danger' },
        { label: 'All solutions', to: '/#solutions', active: atHash('solutions') },
        { label: 'Progress & readiness', to: '/#progress', active: atHash('progress') },
        { label: 'Risk & value', to: '/#risk-value', active: atHash('risk-value') },
      ],
    },
    {
      to: '/solutions',
      label: 'Solutions',
      icon: FolderKanban,
      badge: solutions.length,
      hint: 'Every AI initiative. Filter, sort, and open a workspace',
      subs: [
        { label: 'All solutions', to: '/solutions', active: (l) => l.pathname === '/solutions' && !l.search },
        { label: 'Needs attention', to: '/solutions?status=attention', active: (l) => l.pathname === '/solutions' && search(l).get('status') === 'attention', badge: attention, tone: 'danger' },
        { label: 'In production', to: '/solutions?stage=production', active: (l) => l.pathname === '/solutions' && search(l).get('stage') === 'production' },
        { label: 'Board by stage', to: '/solutions?view=board', active: (l) => l.pathname === '/solutions' && search(l).get('view') === 'board' },
      ],
    },
    {
      to: '/reports',
      label: 'Reports',
      icon: BarChart3,
      hint: 'Executive reporting on health, delivery, risk, value, and AI quality',
      subs: [
        { label: 'Portfolio health', to: '/reports#health', active: atHash('health') },
        { label: 'Delivery', to: '/reports#delivery', active: atHash('delivery', 'performance', 'bottlenecks') },
        { label: 'Risk', to: '/reports#risk', active: atHash('risk') },
        { label: 'Value & adoption', to: '/reports#value', active: atHash('value', 'adoption') },
        { label: 'AI quality', to: '/reports#ai', active: atHash('ai') },
      ],
    },
  ]
  const method: NavItem[] = [
    {
      to: '/framework',
      label: 'Lifecycle Framework',
      icon: BookOpenCheck,
      hint: 'The stages, gates, risk tiers, and weights behind every plan',
      subs: [
        { label: 'Stages and gates', to: '/framework#stages', active: atHash('stages') },
        { label: 'Risk tiers', to: '/framework#tiers', active: atHash('tiers') },
        { label: 'Readiness weights', to: '/framework#weights', active: atHash('weights') },
        { label: 'Roles', to: '/framework#roles', active: atHash('roles') },
      ],
    },
  ]

  return (
    <div className="flex h-full flex-col">
      <div className={cn('flex h-14 shrink-0 items-center gap-2.5 px-4', collapsed && 'justify-center px-0')}>
        <Logo />
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[13.5px] font-semibold tracking-[-0.01em] text-fg">Solution Navigator</p>
            <p className="truncate text-[11px] text-fg-subtle">
              <ForgeMark />
            </p>
          </div>
        )}
      </div>

      <nav aria-label="Primary" data-tour="nav" className={cn('flex flex-1 flex-col gap-5 overflow-y-auto px-3 pt-2', collapsed && 'px-2')}>
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
                <Tip key={s.id} content={`${s.name} · ${stageDef(s.stage).name}`} side="right" delay={600}>
                <NavLink
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
                </Tip>
              )
            })}
          </div>
        )}
      </nav>

      <div className={cn('mt-auto flex flex-col gap-0.5 border-t border-border px-3 py-3', collapsed && 'px-2')}>
        <Item item={{ to: '/settings', label: 'Settings', icon: Settings, hint: 'Theme, AI advisor mode, and demo data reset' }} collapsed={collapsed} onNavigate={onNavigate} />
        <div className={cn('mt-2 flex items-center gap-2.5 rounded-lg px-1.5 py-1.5', collapsed && 'justify-center px-0')}>
          <Avatar person={me} size="md" />
          {!collapsed && (
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[12.5px] font-medium text-fg">{me?.name}</p>
              <p className="truncate text-[11px] text-fg-subtle">{me?.title}</p>
            </div>
          )}
          {!collapsed && (
            <Tip content="Dunder Mifflin is fictional. All people, solutions, and numbers are demo data.">
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
