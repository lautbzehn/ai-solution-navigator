import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Slot } from 'radix-ui'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent-soft'
type Size = 'xs' | 'sm' | 'md' | 'icon' | 'icon-sm'

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-fg text-bg hover:bg-fg/90 shadow-[0_1px_0_0_rgb(255_255_255/0.2)_inset] disabled:bg-fg/40',
  secondary:
    'bg-surface-2 text-fg ring-1 ring-inset ring-border-strong hover:bg-surface-3 disabled:text-fg-subtle',
  ghost: 'text-fg-muted hover:text-fg hover:bg-surface-2 disabled:text-fg-faint',
  danger: 'bg-danger-soft text-danger-fg ring-1 ring-inset ring-danger/25 hover:bg-danger/20',
  'accent-soft': 'bg-accent-soft text-accent-fg ring-1 ring-inset ring-accent-line hover:bg-accent/20',
}

const SIZE: Record<Size, string> = {
  xs: 'h-7 px-2 text-[12px] gap-1 rounded-md',
  sm: 'h-8 px-2.5 text-[13px] gap-1.5 rounded-lg',
  md: 'h-9 px-3.5 text-[13.5px] gap-2 rounded-lg',
  icon: 'h-9 w-9 rounded-lg',
  'icon-sm': 'h-7 w-7 rounded-md',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  asChild?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'sm', asChild, className, type = 'button', ...rest },
  ref,
) {
  const Comp = asChild ? Slot.Root : 'button'
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-[background-color,color,box-shadow,transform] duration-150 select-none active:scale-[0.98] disabled:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    />
  )
})
