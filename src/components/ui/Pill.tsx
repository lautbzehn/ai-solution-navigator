import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'accent' | 'info' | 'muted'

const TONE: Record<Tone, string> = {
  neutral: 'bg-surface-3 text-fg-muted ring-border-strong',
  muted: 'bg-transparent text-fg-subtle ring-border',
  success: 'bg-success-soft text-success-fg ring-success/20',
  warning: 'bg-warning-soft text-warning-fg ring-warning/20',
  danger: 'bg-danger-soft text-danger-fg ring-danger/25',
  accent: 'bg-accent-soft text-accent-fg ring-accent-line',
  info: 'bg-info-soft text-info ring-info/20',
}

const DOT: Record<Tone, string> = {
  neutral: 'bg-fg-subtle',
  muted: 'bg-fg-faint',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  accent: 'bg-accent',
  info: 'bg-info',
}

export interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
  dot?: boolean
  icon?: ReactNode
  size?: 'sm' | 'md'
}

export function Pill({ tone = 'neutral', dot, icon, size = 'sm', className, children, ...rest }: PillProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full font-medium whitespace-nowrap ring-1 ring-inset',
        size === 'sm' ? 'h-[22px] px-2 text-[11.5px]' : 'h-6 px-2.5 text-[12px]',
        TONE[tone],
        className,
      )}
      {...rest}
    >
      {dot && <span className={cn('size-1.5 rounded-full', DOT[tone])} aria-hidden />}
      {icon}
      {children}
    </span>
  )
}

export function Dot({ tone = 'neutral', className }: { tone?: Tone; className?: string }) {
  return <span className={cn('inline-block size-2 shrink-0 rounded-full', DOT[tone], className)} aria-hidden />
}

export const toneText: Record<Tone, string> = {
  neutral: 'text-fg-muted',
  muted: 'text-fg-subtle',
  success: 'text-success-fg',
  warning: 'text-warning-fg',
  danger: 'text-danger-fg',
  accent: 'text-accent-fg',
  info: 'text-info',
}

export const toneBg: Record<Tone, string> = {
  neutral: 'bg-fg-subtle',
  muted: 'bg-fg-faint',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  accent: 'bg-accent',
  info: 'bg-info',
}
