import { useRef, useState, type ReactNode } from 'react'
import { Popover, Tooltip as RTooltip } from 'radix-ui'
import { Info } from 'lucide-react'
import { cn } from '@/lib/cn'
import { GLOSSARY, type GlossaryKey } from '@/config/glossary'

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <RTooltip.Provider delayDuration={250} skipDelayDuration={150}>
      {children}
    </RTooltip.Provider>
  )
}

/** Hover/focus tooltip for short labels on interactive elements. */
export function Tip({ content, children, side = 'top', delay }: { content: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right'; delay?: number }) {
  if (!content) return <>{children}</>
  return (
    <RTooltip.Root delayDuration={delay}>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content
          side={side}
          sideOffset={6}
          className="z-[70] max-w-[280px] animate-pop-in rounded-lg bg-surface-3 px-2.5 py-1.5 text-[12px] leading-snug text-fg shadow-pop"
        >
          {content}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  )
}

/** Rich hover card that also opens on keyboard focus and tap, so it is never hover-only. */
export function HoverCard({
  trigger,
  children,
  side = 'top',
  align = 'center',
  width = 300,
  label,
  triggerClassName,
}: {
  trigger: ReactNode
  children: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
  width?: number
  label: string
  triggerClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<number | undefined>(undefined)
  const openNow = () => {
    window.clearTimeout(closeTimer.current)
    setOpen(true)
  }
  const closeSoon = () => {
    closeTimer.current = window.setTimeout(() => setOpen(false), 140)
  }
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={label}
        onPointerEnter={(e) => e.pointerType === 'mouse' && openNow()}
        onPointerLeave={(e) => e.pointerType === 'mouse' && closeSoon()}
        onFocus={openNow}
        onBlur={closeSoon}
        className={triggerClassName}
      >
        {trigger}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side={side}
          align={align}
          sideOffset={8}
          collisionPadding={12}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onPointerEnter={openNow}
          onPointerLeave={closeSoon}
          style={{ width }}
          className="z-[70] animate-pop-in rounded-xl bg-surface-3 p-3.5 text-[12.5px] leading-relaxed text-fg-muted shadow-pop"
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/** Explanatory "i" tooltip for concepts; works with hover, focus, and tap. */
export function InfoTip({
  term,
  title,
  children,
  className,
  side = 'top',
  label,
}: {
  term?: GlossaryKey
  title?: string
  children?: ReactNode
  className?: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  label?: string
}) {
  const entry = term ? GLOSSARY[term] : undefined
  const heading = title ?? entry?.title
  const body = children ?? entry?.body
  return (
    <HoverCard
      side={side}
      width={280}
      label={label ?? `About ${heading ?? 'this'}`}
      triggerClassName={cn(
        'inline-flex size-4 shrink-0 items-center justify-center rounded-full text-fg-faint transition-colors hover:text-fg-muted focus-visible:text-fg-muted',
        className,
      )}
      trigger={<Info className="size-3.5" strokeWidth={2} />}
    >
      {heading && <p className="mb-1 text-[12.5px] font-semibold text-fg">{heading}</p>}
      <div>{body}</div>
    </HoverCard>
  )
}
