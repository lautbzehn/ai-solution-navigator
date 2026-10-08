import { useEffect } from 'react'
import { Link, Outlet, ScrollRestoration, useLocation, useParams } from 'react-router'
import { Dialog } from 'radix-ui'
import { ChevronRight, Menu, PanelLeftClose, PanelLeftOpen, Plus, Search } from 'lucide-react'
import { useStore } from '@/data/store'
import { useUI } from '@/data/ui'
import { cn } from '@/lib/cn'
import { CreateSolutionWizard } from '@/features/create/CreateSolutionWizard'
import { Button } from '../ui/Button'
import { Kbd } from '../ui/misc'
import { Tip } from '../ui/Tooltip'
import { CommandPalette } from './CommandPalette'
import { Sidebar, SidebarContent } from './Sidebar'
import { AdvisorSlot } from './AdvisorSlot'

const PAGE_NAMES: Record<string, string> = {
  '': 'Dashboard',
  solutions: 'Solutions',
  reports: 'Portfolio Intelligence',
  framework: 'Lifecycle Framework',
  settings: 'Settings',
}

function Breadcrumbs() {
  const location = useLocation()
  const params = useParams()
  const solution = useStore((s) => s.solutions.find((x) => x.id === params.id))
  const [first] = location.pathname.split('/').filter(Boolean)
  const crumbs: { label: string; to?: string }[] = [{ label: PAGE_NAMES[first ?? ''] ?? 'Not found', to: first ? `/${first}` : '/' }]
  if (solution) crumbs.push({ label: solution.name })
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[13px]">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1
        return (
          <span key={i} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-fg-faint" />}
            {last || !c.to ? (
              <span aria-current="page" className="truncate font-medium text-fg">{c.label}</span>
            ) : (
              <Link to={c.to} className="truncate text-fg-subtle hover:text-fg">{c.label}</Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}

function Topbar() {
  const { sidebarCollapsed, toggleSidebar, setPalette, setCreate, setMobileNav } = useUI()
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-bg/80 px-4 backdrop-blur-md md:px-5">
      <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label="Open navigation" onClick={() => setMobileNav(true)}>
        <Menu />
      </Button>
      <Tip content={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
        <Button variant="ghost" size="icon-sm" className="hidden md:inline-flex" aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={toggleSidebar}>
          {sidebarCollapsed ? <PanelLeftOpen strokeWidth={1.6} /> : <PanelLeftClose strokeWidth={1.6} />}
        </Button>
      </Tip>
      <Breadcrumbs />
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={() => setPalette(true)}
          className="hidden h-8 w-56 items-center gap-2 rounded-lg bg-surface px-2.5 text-[12.5px] text-fg-subtle ring-1 ring-border transition-colors hover:bg-surface-2 hover:text-fg-muted lg:flex"
        >
          <Search className="size-3.5" />
          <span className="flex-1 text-left">Search solutions…</span>
          <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
          <Kbd>K</Kbd>
        </button>
        <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Search" onClick={() => setPalette(true)}>
          <Search />
        </Button>
        <AdvisorSlot.Toggle />
        <Button variant="primary" size="sm" onClick={() => setCreate(true)}>
          <Plus strokeWidth={2.2} />
          <span className="hidden sm:inline">New solution</span>
        </Button>
      </div>
    </header>
  )
}

function MobileNav() {
  const { mobileNavOpen, setMobileNav } = useUI()
  return (
    <Dialog.Root open={mobileNavOpen} onOpenChange={setMobileNav}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-black/50 md:hidden" />
        <Dialog.Content className="fixed top-0 bottom-0 left-0 z-50 w-[260px] animate-pop-in border-r border-border bg-bg-subtle md:hidden">
          <Dialog.Title className="sr-only">Navigation</Dialog.Title>
          <Dialog.Description className="sr-only">Primary navigation</Dialog.Description>
          <SidebarContent collapsed={false} onNavigate={() => setMobileNav(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function AppShell() {
  const setPalette = useUI((s) => s.setPalette)
  const advisorOpen = useUI((s) => s.advisorOpen)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setPalette])

  return (
    <div className="flex min-h-dvh bg-bg">
      <a href="#main" className="sr-only z-[100] rounded-md bg-surface-3 px-3 py-2 text-fg focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Skip to content
      </a>
      <Sidebar />
      <MobileNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <div className="flex min-h-0 flex-1">
          <main id="main" className={cn('page-glow min-w-0 flex-1')}>
            <Outlet />
          </main>
          {advisorOpen && <AdvisorSlot.Panel />}
        </div>
      </div>
      <CommandPalette />
      <CreateSolutionWizard />
      {/* Key by path: fresh page loads otherwise share one key and inherit each other's scroll position. */}
      <ScrollRestoration getKey={(location) => location.pathname} />
    </div>
  )
}
