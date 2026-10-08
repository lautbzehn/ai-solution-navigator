import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Page({ children, className, wide }: { children: ReactNode; className?: string; wide?: boolean }) {
  return <div className={cn('mx-auto w-full px-4 py-6 md:px-8 md:py-8', wide ? 'max-w-[1600px]' : 'max-w-[1440px]', className)}>{children}</div>
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5">{eyebrow}</div>}
        <h1 className="text-[24px] leading-tight font-semibold tracking-[-0.025em] text-fg md:text-[26px]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-[13.5px] text-fg-subtle">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
