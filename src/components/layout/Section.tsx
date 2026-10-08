import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import { ChevronRight, ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '../ui/Button'
import { Tip } from '../ui/Tooltip'

/* Progressive disclosure for busy pages. Each page is a stack of sections whose
   headers carry a one-line headline, so a collapsed page still reads as an
   executive summary. The first section starts open, the viewer's choices are
   remembered per page, and a #hash (from the sidebar or a link) opens and
   scrolls to its section. */

const read = (key: string): string[] | undefined => {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as string[]) : undefined
  } catch {
    return undefined
  }
}

export interface SectionsState {
  isOpen(id: string): boolean
  toggle(id: string): void
  expandAll(): void
  collapseAll(): void
  allOpen: boolean
  /** Props for a <Section>: id, open state, and toggle handler. */
  bind(id: string): { id: string; open: boolean; onToggle: () => void }
}

export function useSections(page: string, ids: readonly string[], aliases: Record<string, string> = {}): SectionsState {
  const key = `asn-open:${page}`
  const [open, setOpen] = useState<Set<string>>(() => new Set((read(key) ?? [ids[0]]).filter((id) => ids.includes(id))))
  const location = useLocation()

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify([...open]))
    } catch {
      /* per-viewer convenience only */
    }
  }, [key, open])

  // Deep links: /reports#risk opens the Risk section and brings it into view.
  useEffect(() => {
    const raw = decodeURIComponent(location.hash.slice(1))
    const id = aliases[raw] ?? raw
    if (!id || !ids.includes(id)) return
    setOpen((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))
    // Wait a beat so the opened content has rendered and the page is tall enough to scroll.
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: reduce || document.hidden ? 'auto' : 'smooth', block: 'start' }), 60)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key])

  const toggle = useCallback((id: string) => {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  return useMemo(
    () => ({
      isOpen: (id) => open.has(id),
      toggle,
      expandAll: () => setOpen(new Set(ids)),
      collapseAll: () => setOpen(new Set()),
      allOpen: ids.every((id) => open.has(id)),
      bind: (id) => ({ id, open: open.has(id), onToggle: () => toggle(id) }),
    }),
    [open, ids, toggle],
  )
}

export function ExpandAllButton({ sections }: { sections: SectionsState }) {
  const all = sections.allOpen
  return (
    <Tip content={all ? 'Fold every section back to its one-line summary' : 'Open every section on this page'}>
      <Button variant="ghost" size="sm" onClick={all ? sections.collapseAll : sections.expandAll} aria-label={all ? 'Collapse all sections' : 'Expand all sections'}>
        {all ? <ChevronsDownUp /> : <ChevronsUpDown />}
        <span>{all ? 'Collapse all' : 'Expand all'}</span>
      </Button>
    </Tip>
  )
}

export function Section({
  id,
  title,
  icon,
  summary,
  actions,
  open,
  onToggle,
  children,
  tone,
}: {
  id: string
  title: ReactNode
  icon?: ReactNode
  /** One-line headline shown whether the section is open or not. */
  summary?: ReactNode
  /** Controls on the right of the header (e.g. the AI advisor star). Kept outside the toggle button. */
  actions?: ReactNode
  open: boolean
  onToggle: () => void
  children: ReactNode
  /** Tints the icon when the section needs attention. */
  tone?: 'danger' | 'warning' | 'success'
}) {
  const contentId = `${id}-content`
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20">
      <div
        data-section-header
        className={cn(
          'flex items-center gap-1 rounded-xl bg-surface pr-2 shadow-card ring-1 transition-colors',
          open ? 'ring-border-strong' : 'ring-border hover:bg-surface-2/60',
        )}
      >
        <h2 className="min-w-0 flex-1">
          <button
            type="button"
            id={`${id}-title`}
            aria-expanded={open}
            aria-controls={contentId}
            onClick={onToggle}
            className="flex w-full items-center gap-3 rounded-xl py-3 pl-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight className={cn('size-4 shrink-0 text-fg-subtle transition-transform duration-200', open && 'rotate-90 text-fg-muted')} aria-hidden />
            {icon && (
              <span
                className={cn(
                  'grid size-8 shrink-0 place-items-center rounded-lg ring-1 [&_svg]:size-4',
                  tone === 'danger' ? 'bg-danger-soft text-danger-fg ring-danger/20' : tone === 'warning' ? 'bg-warning-soft text-warning-fg ring-warning/20' : tone === 'success' ? 'bg-success-soft text-success-fg ring-success/20' : 'bg-surface-2 text-fg-muted ring-border',
                )}
                aria-hidden
              >
                {icon}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px] font-semibold tracking-[-0.01em] text-fg">{title}</span>
              {summary && <span className="mt-0.5 line-clamp-2 text-[12.5px] text-fg-subtle sm:line-clamp-1">{summary}</span>}
            </span>
          </button>
        </h2>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </div>
      {open && (
        <div id={contentId} className="mt-3 mb-3 animate-rise">
          {children}
        </div>
      )}
    </section>
  )
}

/** Vertical stack of sections with consistent spacing. */
export function SectionStack({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-[minmax(0,1fr)] gap-3', className)}>{children}</div>
}
