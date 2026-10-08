import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-xl bg-surface shadow-card ring-1 ring-border', className)} {...rest} />
}

export function CardHeader({
  title,
  subtitle,
  actions,
  icon,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  icon?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3 px-5 pt-4 pb-3', className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && <span className="mt-0.5 text-fg-subtle [&_svg]:size-4">{icon}</span>}
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-[13.5px] font-semibold tracking-[-0.01em] text-fg">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[12.5px] text-fg-subtle">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </div>
  )
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 pb-5', className)} {...rest} />
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-[11px] font-semibold tracking-[0.06em] text-fg-subtle uppercase', className)}>{children}</p>
}
