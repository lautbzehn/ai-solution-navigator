import { cn } from '@/lib/cn'
import { initials } from '@/lib/format'
import { useStore } from '@/data/store'
import type { Person } from '@/domain/types'
import { Tip } from './Tooltip'

const SIZE = { xs: 'size-5 text-[9px]', sm: 'size-6 text-[10px]', md: 'size-8 text-[11.5px]', lg: 'size-10 text-[13px]' }

export function Avatar({ person, size = 'sm', className, tip = true }: { person?: Person; size?: keyof typeof SIZE; className?: string; tip?: boolean }) {
  if (!person) {
    return <span className={cn('inline-flex items-center justify-center rounded-full bg-surface-3 text-fg-faint ring-1 ring-border', SIZE[size], className)}>?</span>
  }
  const el = (
    <span
      className={cn('avatar inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight select-none', SIZE[size], className)}
      style={{ '--h': person.hue } as React.CSSProperties}
      aria-label={person.name}
      role="img"
    >
      {initials(person.name)}
    </span>
  )
  return tip ? <Tip content={`${person.name} · ${person.title}`}>{el}</Tip> : el
}

export function PersonChip({ id, size = 'xs', showTitle, className }: { id?: string; size?: keyof typeof SIZE; showTitle?: boolean; className?: string }) {
  const person = useStore((s) => s.people.find((p) => p.id === id))
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      <Avatar person={person} size={size} tip={false} />
      <span className="min-w-0 truncate text-fg-muted">
        {person?.name ?? 'Unassigned'}
        {showTitle && person && <span className="text-fg-subtle"> · {person.title}</span>}
      </span>
    </span>
  )
}

export function AvatarStack({ ids, max = 4, size = 'sm' }: { ids: string[]; max?: number; size?: keyof typeof SIZE }) {
  const people = useStore((s) => s.people)
  const list = ids.map((id) => people.find((p) => p.id === id)).filter(Boolean) as Person[]
  const shown = list.slice(0, max)
  const rest = list.length - shown.length
  return (
    <span className="flex items-center -space-x-1.5">
      {shown.map((p) => (
        <Avatar key={p.id} person={p} size={size} className="ring-2 ring-surface" />
      ))}
      {rest > 0 && (
        <span className={cn('inline-flex items-center justify-center rounded-full bg-surface-3 font-medium text-fg-muted ring-2 ring-surface', SIZE[size])}>+{rest}</span>
      )}
    </span>
  )
}
