import type { ReactNode } from 'react'
import { DropdownMenu } from 'radix-ui'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
  compact,
}: {
  icon?: ReactNode
  title: string
  body?: ReactNode
  action?: ReactNode
  className?: string
  compact?: boolean
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'px-4 py-8' : 'px-6 py-14', className)}>
      {icon && (
        <div className="mb-3 grid size-10 place-items-center rounded-xl bg-surface-2 text-fg-subtle ring-1 ring-border [&_svg]:size-[18px]">{icon}</div>
      )}
      <p className="text-[14px] font-semibold text-fg">{title}</p>
      {body && <p className="mt-1.5 max-w-[420px] text-[13px] leading-relaxed text-balance text-fg-subtle">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] bg-surface-3 px-1 font-mono text-[10.5px] font-medium text-fg-subtle ring-1 ring-border-strong">
      {children}
    </kbd>
  )
}

export interface MenuOption<T extends string> {
  value: T
  label: string
  icon?: ReactNode
  hint?: string
  disabled?: boolean
  disabledReason?: string
}

/** Pill-shaped dropdown for inline status changes. */
export function MenuSelect<T extends string>({
  value,
  options,
  onChange,
  trigger,
  label,
  align = 'start',
}: {
  value: T
  options: MenuOption<T>[]
  onChange: (v: T) => void
  trigger: ReactNode
  label: string
  align?: 'start' | 'end'
}) {
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        aria-label={label}
        className="group inline-flex items-center gap-0.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={(e) => e.stopPropagation()}
      >
        {trigger}
        <ChevronDown className="size-3 text-fg-faint opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 group-data-[state=open]:opacity-100" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={6}
          onClick={(e) => e.stopPropagation()}
          className="z-[70] min-w-[200px] animate-pop-in rounded-xl bg-surface-2 p-1 shadow-pop"
        >
          <DropdownMenu.Label className="px-2 pt-1 pb-1.5 text-[11px] font-medium text-fg-subtle">{label}</DropdownMenu.Label>
          {options.map((o) => (
            <DropdownMenu.Item
              key={o.value}
              disabled={o.disabled}
              onSelect={() => onChange(o.value)}
              className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-[13px] text-fg outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-45 data-[highlighted]:bg-surface-3"
            >
              <span className="mt-0.5 flex size-4 items-center justify-center">{o.icon}</span>
              <span className="flex-1">
                {o.label}
                {(o.hint || (o.disabled && o.disabledReason)) && (
                  <span className="block text-[11.5px] text-fg-subtle">{o.disabled ? o.disabledReason : o.hint}</span>
                )}
              </span>
              {o.value === value && <Check className="mt-0.5 size-3.5 text-accent-fg" />}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

export function Segmented<T extends string>({ value, onChange, options, label, size = 'sm' }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; label: string; size?: 'sm' | 'xs' }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-surface-2 p-0.5 ring-1 ring-inset ring-border">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-md font-medium transition-colors',
            size === 'sm' ? 'h-7 px-2.5 text-[12.5px]' : 'h-6 px-2 text-[11.5px]',
            value === o.value ? 'bg-surface-3 text-fg shadow-sm ring-1 ring-border-strong' : 'text-fg-subtle hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Stat({ label, value, sub, className }: { label: ReactNode; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="flex items-center gap-1 text-[12px] text-fg-subtle">{label}</p>
      <p className="mt-0.5 text-[18px] font-semibold tracking-[-0.02em] text-fg tabular">{value}</p>
      {sub && <p className="text-[12px] text-fg-subtle">{sub}</p>}
    </div>
  )
}
