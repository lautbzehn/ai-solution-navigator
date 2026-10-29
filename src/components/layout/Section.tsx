import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import { ChevronRight, ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '../ui/Button'
import { Tip } from '../ui/Tooltip'

/* Progressive disclosure for busy pages. Each page is a stack of sections whose
   headers carry a one-line headline, so a collapsed page still reads as an
   executive summary. Every section starts open (on phones, just the first),
   the sections a viewer folds or opens are remembered per page, and a #hash
   (from the sidebar or a link) opens and scrolls to its section. */

const isPhone = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches

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
  // A fresh prefix: the old one saved "first section only" on every visit, which hid the open default.
  const key = `asn-sections:${page}`
  const [open, setOpen] = useState<Set<string>>(() => new Set((read(key) ?? (isPhone() ? [ids[0]] : ids)).filter((id) => ids.includes(id))))
  const location = useLocation()

  // Only the viewer's own choices are remembered, never the default a page opened with.
  const chosen = useRef(false)
  const choose = useCallback((update: (prev: Set<string>) => Set<string>) => {
    chosen.current = true
    setOpen(update)
  }, [])
  useEffect(() => {
    if (!chosen.current) return
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

  const toggle = useCallback(
    (id: string) =>
      choose((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      }),
    [choose],
  )

  return useMemo(
    () => ({
      isOpen: (id) => open.has(id),
      toggle,
      expandAll: () => choose(() => new Set(ids)),
      collapseAll: () => choose(() => new Set()),
      allOpen: ids.every((id) => open.has(id)),
      bind: (id) => ({ id, open: open.has(id), onToggle: () => toggle(id) }),
    }),
    [open, ids, toggle, choose],
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
  hue = 'slate',
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
  /** Tints the icon when the section needs attention. Status wins over the category color. */
  tone?: 'danger' | 'warning' | 'success'
  /** The section's category color (see index.css). */
  hue?: Hue
}) {
  const contentId = `${id}-content`
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20" style={{ '--cat': hueVar(hue) } as CSSProperties} data-hue={hue}>
      <div
        data-section-header
        className={cn(
          'cat-head flex items-center gap-1 rounded-xl bg-surface pr-2 shadow-card ring-1 transition-colors',
          open ? 'ring-[color-mix(in_oklch,var(--cat)_38%,transparent)]' : 'ring-border hover:bg-surface-2/60',
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
            <ChevronRight className={cn('size-4 shrink-0 text-[var(--cat)] transition-transform duration-200', open && 'rotate-90')} aria-hidden />
            {icon && (
              <span
                className={cn(
                  'grid size-8 shrink-0 place-items-center rounded-lg ring-1 [&_svg]:size-4',
                  tone === 'danger' ? 'bg-danger-soft text-danger-fg ring-danger/20' : tone === 'warning' ? 'bg-warning-soft text-warning-fg ring-warning/20' : tone === 'success' ? 'bg-success-soft text-success-fg ring-success/20' : 'cat-icon ring-0',
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
        <div id={contentId} className="cat-body mt-3 mb-3 animate-rise">
          {children}
        </div>
      )}
    </section>
  )
}

/** Category hue for a section: one color per kind of information, used across the app. */
export type Hue = 'pink' | 'cyan' | 'blue' | 'lime' | 'violet' | 'teal' | 'slate'
export const hueVar = (h: Hue) => `var(--hue-${h})`

/** Vertical stack of sections with consistent spacing. */
export function SectionStack({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-[minmax(0,1fr)] gap-3', className)}>{children}</div>
}
