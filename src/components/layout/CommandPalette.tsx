import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Dialog } from 'radix-ui'
import { BarChart3, BookOpenCheck, CornerDownLeft, FolderKanban, LayoutDashboard, Plus, Search, Settings } from 'lucide-react'
import { stageDef } from '@/config'
import { useStore } from '@/data/store'
import { useUI } from '@/data/ui'
import { cn } from '@/lib/cn'
import { Kbd } from '../ui/misc'

interface Entry {
  id: string
  label: string
  hint?: string
  icon: ReactNode
  group: string
  run: () => void
}

export function CommandPalette() {
  const { paletteOpen, setPalette, setCreate } = useUI()
  const solutions = useStore((s) => s.solutions)
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)

  const go = (to: string) => () => {
    navigate(to)
    setPalette(false)
  }

  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] = [
      ...solutions.map((s) => ({
        id: s.id,
        label: s.name,
        hint: stageDef(s.stage).name,
        icon: <FolderKanban className="size-4" />,
        group: 'Solutions',
        run: go(`/solutions/${s.id}`),
      })),
      { id: 'new', label: 'Create a new solution', icon: <Plus className="size-4" />, group: 'Actions', run: () => { setPalette(false); setCreate(true) } },
      { id: 'dash', label: 'My Overview', icon: <LayoutDashboard className="size-4" />, group: 'Go to', run: go('/') },
      { id: 'sol', label: 'Solutions Hub', icon: <FolderKanban className="size-4" />, group: 'Go to', run: go('/solutions') },
      { id: 'rep', label: 'Portfolio Intelligence', icon: <BarChart3 className="size-4" />, group: 'Go to', run: go('/reports') },
      { id: 'fw', label: 'Lifecycle Framework', icon: <BookOpenCheck className="size-4" />, group: 'Go to', run: go('/framework') },
      { id: 'set', label: 'Settings', icon: <Settings className="size-4" />, group: 'Go to', run: go('/settings') },
    ]
    const q = query.trim().toLowerCase()
    return q ? list.filter((e) => `${e.label} ${e.hint ?? ''}`.toLowerCase().includes(q)) : list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solutions, query])

  const active = Math.min(index, Math.max(0, entries.length - 1))
  const groups = Array.from(new Set(entries.map((e) => e.group)))

  return (
    <Dialog.Root
      open={paletteOpen}
      onOpenChange={(o) => {
        setPalette(o)
        if (!o) {
          setQuery('')
          setIndex(0)
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-black/50 backdrop-blur-[2px]" />
        <Dialog.Content
          className="fixed top-[14vh] left-1/2 z-50 w-[calc(100vw-32px)] max-w-[560px] -translate-x-1/2 animate-pop-in overflow-hidden rounded-2xl bg-surface shadow-pop"
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setIndex((i) => Math.min(entries.length - 1, i + 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setIndex((i) => Math.max(0, i - 1))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              entries[active]?.run()
            }
          }}
        >
          <Dialog.Title className="sr-only">Search and commands</Dialog.Title>
          <Dialog.Description className="sr-only">Search solutions or jump to a page. Use arrow keys and Enter.</Dialog.Description>
          <div className="flex items-center gap-3 border-b border-border px-4">
            <Search className="size-4 text-fg-subtle" />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setIndex(0)
              }}
              placeholder="Search solutions, pages, or actions…"
              aria-label="Search"
              className="h-12 flex-1 bg-transparent text-[14px] text-fg outline-none placeholder:text-fg-faint"
            />
            <Kbd>Esc</Kbd>
          </div>
          <div role="listbox" aria-label="Results" className="max-h-[52vh] overflow-y-auto p-1.5">
            {entries.length === 0 && <p className="px-3 py-8 text-center text-[13px] text-fg-subtle">No matches for "{query}"</p>}
            {groups.map((g) => (
              <div key={g} className="mb-1">
                <p className="px-2.5 pt-2 pb-1 text-[10.5px] font-semibold tracking-[0.08em] text-fg-faint uppercase">{g}</p>
                {entries
                  .filter((e) => e.group === g)
                  .map((e) => {
                    const i = entries.indexOf(e)
                    return (
                      <button
                        key={e.id}
                        role="option"
                        aria-selected={i === active}
                        onMouseMove={() => setIndex(i)}
                        onClick={e.run}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[13px]',
                          i === active ? 'bg-surface-3 text-fg' : 'text-fg-muted',
                        )}
                      >
                        <span className="text-fg-subtle">{e.icon}</span>
                        <span className="flex-1 truncate">{e.label}</span>
                        {e.hint && <span className="text-[11px] tracking-wide text-fg-faint uppercase">{e.hint}</span>}
                        {i === active && <CornerDownLeft className="size-3.5 text-fg-subtle" />}
                      </button>
                    )
                  })}
              </div>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
