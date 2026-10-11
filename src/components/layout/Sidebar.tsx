import { useCallback, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useMatch, type Location } from 'react-router'
import { BarChart3, BookOpenCheck, ChevronRight, Coffee, FolderKanban, LayoutDashboard, Settings, Star, type LucideIcon } from 'lucide-react'
import { stageDef } from '@/config'
import { usePortfolio } from '@/data/hooks'
import { useStore } from '@/data/store'
import { CURRENT_USER_ID } from '@/data/seed/people'
import { useUI } from '@/data/ui'
import { cn } from '@/lib/cn'
import { Avatar } from '../ui/Avatar'
import { Tip } from '../ui/Tooltip'
import { FavoriteStar } from '../FavoriteStar'
import { BrandName, ForgeMark } from '../brand/ForgeMark'
import { hueVar, type Hue } from './Section'
import { Logo } from './Logo'

interface SubItem {
  label: string
  to: string
  /** Matches the color of the section it opens. */
  hue: Hue
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
  /** Sub-categories: open by default on the current page, and collapsible at any time. */
  subs?: SubItem[]
}

const atHash = (id: string, ...aliases: string[]) => (l: Location) => [id, ...aliases].includes(decodeURIComponent(l.hash.slice(1)))

/* Which sidebar groups the viewer opened or closed. Their choice wins; without one,
   the current page's group is open and the rest are closed. A per-viewer convenience. */
const NAV_KEY = 'asn-nav-open'
function useNavOpen() {
  const [choices, setChoices] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(window.localStorage.getItem(NAV_KEY) ?? '{}') as Record<string, boolean>
    } catch {
      return {}
    }
  })
  const set = useCallback((key: string, open: boolean) => {
    setChoices((prev) => {
      const next = { ...prev, [key]: open }
      try {
        window.localStorage.setItem(NAV_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])
  return { choices, set }
}
type NavOpen = ReturnType<typeof useNavOpen>

function Caret({ open, label, controls, onToggle }: { open: boolean; label: string; controls: string; onToggle: () => void }) {
  return (
    <Tip content={open ? `Hide ${label} sections` : `Show ${label} sections`} side="right" delay={500}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={controls}
        aria-label={open ? `Hide ${label} sections` : `Show ${label} sections`}
        onClick={onToggle}
        className="absolute top-1/2 right-1 grid size-6 -translate-y-1/2 place-items-center rounded-md text-fg-subtle transition-colors hover:bg-surface-3 hover:text-fg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <ChevronRight className={cn('size-3.5 transition-transform duration-200', open && 'rotate-90')} />
      </button>
    </Tip>
  )
}

function Item({ item, collapsed, onNavigate, nav }: { item: NavItem; collapsed: boolean; onNavigate?: () => void; nav: NavOpen }) {
  const location = useLocation()
  const match = useMatch({ path: item.to, end: !!item.end })
  const hasSubs = !collapsed && !!item.subs?.length
  const open = hasSubs && (nav.choices[item.to] ?? !!match)
  const listId = `nav-subs-${item.to.replace(/\W/g, '') || 'home'}`
  const link = (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      // A plain string, not NavLink's function form: the tooltip wrapper merges class names as text.
      className={cn(
        'group relative flex h-8 items-center gap-2.5 rounded-lg text-[13px] transition-colors duration-150',
        collapsed ? 'justify-center px-0' : hasSubs ? 'pr-8 pl-2.5' : 'px-2.5',
        match ? 'bg-surface-3 font-medium text-fg' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
      )}
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
      <div className="relative">
        <Tip content={collapsed ? <><b className="font-semibold">{item.label}</b> · {item.hint}</> : item.hint} side="right" delay={collapsed ? undefined : 600}>
          {link}
        </Tip>
        {hasSubs && <Caret open={open} label={item.label} controls={listId} onToggle={() => nav.set(item.to, !open)} />}
      </div>
      {open && (
        <ul id={listId} className="mt-0.5 mb-1 ml-[17px] grid animate-fade-in gap-px border-l border-border pl-2" aria-label={`${item.label} sections`}>
          {item.subs!.map((sub) => {
            const active = !!match && sub.active(location)
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
                  <span aria-hidden className={cn('h-3.5 w-[3px] shrink-0 rounded-full transition-opacity', active ? 'opacity-100' : 'opacity-70')} style={{ background: hueVar(sub.hue) }} />
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

/** A labeled sidebar group (Methodology, Favorites, Recent) that opens and closes at any time. */
function Group({ id, label, nav, children, collapsed, count }: { id: string; label: string; nav: NavOpen; children: ReactNode; collapsed: boolean; count?: number }) {
  const open = nav.choices[`group:${id}`] ?? true
  if (collapsed) return <div className="flex flex-col gap-0.5">{children}</div>
  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`nav-group-${id}`}
        onClick={() => nav.set(`group:${id}`, !open)}
        className="group flex h-6 items-center gap-1 rounded-md px-2.5 text-left text-[10.5px] font-semibold tracking-[0.08em] text-fg-faint uppercase transition-colors hover:text-fg-subtle focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className="flex-1">{label}</span>
        {count !== undefined && count > 0 && <span className="font-medium tracking-normal tabular">{count}</span>}
        <ChevronRight className={cn('size-3 transition-transform duration-200', open && 'rotate-90')} aria-hidden />
      </button>
      {open && (
        <div id={`nav-group-${id}`} className="flex animate-fade-in flex-col gap-0.5">
          {children}
        </div>
      )}
    </div>
  )
}

function SolutionLink({ id, name, stage, active, onNavigate, lead }: { id: string; name: string; stage: Parameters<typeof stageDef>[0]; active: boolean; onNavigate?: () => void; lead: ReactNode }) {
  return (
    <Tip content={`${name} · ${stageDef(stage).name}`} side="right" delay={600}>
      <NavLink
        to={`/solutions/${id}`}
        onClick={onNavigate}
        className={cn('group flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[12.5px] transition-colors', active ? 'bg-surface-2 text-fg' : 'text-fg-subtle hover:bg-surface-2 hover:text-fg-muted')}
      >
        <span className="grid size-4 shrink-0 place-items-center">{lead}</span>
        <span className="flex-1 truncate">{name.replace(/^AI /, '')}</span>
        <span className="text-[10px] tracking-wide text-fg-faint uppercase">{stageDef(stage).name.slice(0, 3)}</span>
      </NavLink>
    </Tip>
  )
}

export function SidebarContent({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const solutions = useStore((s) => s.solutions)
  const favoriteIds = useStore((s) => s.settings.favorites) ?? NO_FAVORITES
  const viewed = useUI((s) => s.recentlyViewed)
  const me = useStore((s) => s.people.find((p) => p.id === CURRENT_USER_ID))
  const location = useLocation()
  const attention = usePortfolio().filter((i) => i.health.status !== 'on_track').length
  const nav = useNavOpen()

  const byId = new Map(solutions.map((s) => [s.id, s]))
  const present = <T,>(x: T | undefined): x is T => x !== undefined
  const favorites = favoriteIds.map((id) => byId.get(id)).filter(present)
  // What this viewer opened most recently; until they open something, what changed most recently.
  const viewedList = viewed.map((id) => byId.get(id)).filter(present).filter((s) => !favoriteIds.includes(s.id))
  const recent = (viewedList.length ? viewedList : [...solutions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).filter((s) => !favoriteIds.includes(s.id))).slice(0, 5)
  const search = (l: Location) => new URLSearchParams(l.search)
  const isOpenSolution = (id: string) => location.pathname.startsWith(`/solutions/${id}`)

  const main: NavItem[] = [
    {
      to: '/',
      label: 'My Overview',
      icon: LayoutDashboard,
      end: true,
      hint: 'Your portfolio at a glance: what needs you, progress, risk, and value',
      subs: [
        { label: 'Needs your attention', hue: 'pink', to: '/#attention', active: atHash('attention'), badge: attention, tone: 'danger' },
        { label: 'All solutions', hue: 'cyan', to: '/#solutions', active: atHash('solutions') },
        { label: 'Progress & readiness', hue: 'blue', to: '/#progress', active: atHash('progress') },
        { label: 'Risk & value', hue: 'lime', to: '/#risk-value', active: atHash('risk-value') },
      ],
    },
    {
      to: '/solutions',
      label: 'Solutions Hub',
      icon: FolderKanban,
      badge: solutions.length,
      hint: 'Every AI initiative in one place. Filter, sort, star, and open a workspace',
      subs: [
        { label: 'All solutions', hue: 'cyan', to: '/solutions', active: (l) => l.pathname === '/solutions' && !l.search },
        { label: 'Needs attention', hue: 'pink', to: '/solutions?status=attention', active: (l) => l.pathname === '/solutions' && search(l).get('status') === 'attention', badge: attention, tone: 'danger' },
        { label: 'In production', hue: 'lime', to: '/solutions?stage=production', active: (l) => l.pathname === '/solutions' && search(l).get('stage') === 'production' },
        { label: 'Board by stage', hue: 'blue', to: '/solutions?view=board', active: (l) => l.pathname === '/solutions' && search(l).get('view') === 'board' },
      ],
    },
    {
      to: '/reports',
      label: 'Reports',
      icon: BarChart3,
      hint: 'Executive reporting on health, delivery, risk, value, and AI quality',
      subs: [
        { label: 'Portfolio health', hue: 'cyan', to: '/reports#health', active: atHash('health') },
        { label: 'Delivery', hue: 'blue', to: '/reports#delivery', active: atHash('delivery', 'performance', 'bottlenecks') },
        { label: 'Risk', hue: 'pink', to: '/reports#risk', active: atHash('risk') },
        { label: 'Value & adoption', hue: 'lime', to: '/reports#value', active: atHash('value', 'adoption') },
        { label: 'AI quality', hue: 'violet', to: '/reports#ai', active: atHash('ai') },
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
        { label: 'Stages and gates', hue: 'blue', to: '/framework#stages', active: atHash('stages') },
        { label: 'Risk tiers', hue: 'pink', to: '/framework#tiers', active: atHash('tiers') },
        { label: 'Readiness weights', hue: 'teal', to: '/framework#weights', active: atHash('weights') },
        { label: 'Roles', hue: 'slate', to: '/framework#roles', active: atHash('roles') },
      ],
    },
  ]

  return (
    <div className="flex h-full flex-col">
      <div className={cn('flex h-14 shrink-0 items-center gap-2.5 px-3.5', collapsed && 'justify-center px-0')}>
        <Logo />
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[13px] font-semibold tracking-[-0.015em] text-fg">
              <BrandName />
            </p>
            <p className="truncate text-[11px] text-fg-subtle">
              <ForgeMark />
            </p>
          </div>
        )}
      </div>

      <nav aria-label="Primary" data-tour="nav" className={cn('flex flex-1 flex-col gap-4 overflow-y-auto px-3 pt-2 pb-3', collapsed && 'px-2')}>
        <div className="flex flex-col gap-0.5">
          {main.map((i) => (
            <Item key={i.to} item={i} collapsed={collapsed} onNavigate={onNavigate} nav={nav} />
          ))}
        </div>
        <Group id="methodology" label="Methodology" nav={nav} collapsed={collapsed}>
          {method.map((i) => (
            <Item key={i.to} item={i} collapsed={collapsed} onNavigate={onNavigate} nav={nav} />
          ))}
        </Group>
        {!collapsed && (
          <Group id="favorites" label="Favorites" nav={nav} collapsed={collapsed} count={favorites.length}>
            {favorites.length ? (
              favorites.map((s) => (
                <div key={s.id} className="group/fav relative">
                  <SolutionLink id={s.id} name={s.name} stage={s.stage} active={isOpenSolution(s.id)} onNavigate={onNavigate} lead={<Star className="size-3.5 fill-current text-star" />} />
                  <FavoriteStar solutionId={s.id} name={s.name} className="absolute top-1/2 right-1 -translate-y-1/2 bg-bg-subtle opacity-0 group-hover/fav:opacity-100 focus-visible:opacity-100" />
                </div>
              ))
            ) : (
              <p className="flex items-center gap-2 px-2.5 py-1 text-[12px] text-fg-faint">
                <Star className="size-3.5 shrink-0" /> Star a solution to pin it here.
              </p>
            )}
          </Group>
        )}
        {!collapsed && (
          <Group id="recent" label={viewedList.length ? 'Recently viewed' : 'Recently updated'} nav={nav} collapsed={collapsed}>
            {recent.map((s) => (
              <SolutionLink
                key={s.id}
                id={s.id}
                name={s.name}
                stage={s.stage}
                active={isOpenSolution(s.id)}
                onNavigate={onNavigate}
                lead={<span className={cn('size-1.5 rounded-full', isOpenSolution(s.id) ? 'bg-accent' : 'bg-fg-faint group-hover:bg-fg-subtle')} />}
              />
            ))}
          </Group>
        )}
      </nav>

      <div className={cn('mt-auto flex flex-col gap-0.5 border-t border-border px-3 py-3', collapsed && 'px-2')}>
        <Item item={{ to: '/about', label: 'About this project', icon: Coffee, hint: 'Who built this, and why' }} collapsed={collapsed} onNavigate={onNavigate} nav={nav} />
        <Item item={{ to: '/settings', label: 'Settings', icon: Settings, hint: 'Theme, AI advisor mode, and demo data reset' }} collapsed={collapsed} onNavigate={onNavigate} nav={nav} />
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

const NO_FAVORITES: string[] = []

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
