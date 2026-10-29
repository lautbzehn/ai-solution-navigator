import type { ReactNode } from 'react'
import { Dialog as RDialog } from 'radix-ui'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

interface BaseProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  className?: string
}

export function Modal({ open, onOpenChange, title, description, children, footer, className, size = 'md' }: BaseProps & { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-black/55 backdrop-blur-[2px]" />
        <RDialog.Content
          className={cn(
            'fixed top-[8vh] left-1/2 z-50 flex max-h-[84vh] w-[calc(100vw-32px)] -translate-x-1/2 animate-pop-in flex-col rounded-2xl bg-surface shadow-pop',
            size === 'sm' ? 'max-w-[440px]' : size === 'md' ? 'max-w-[560px]' : 'max-w-[720px]',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <RDialog.Title className="text-[15px] font-semibold tracking-[-0.01em] text-fg">{title}</RDialog.Title>
              {description ? (
                <RDialog.Description className="mt-1 text-[13px] text-fg-subtle">{description}</RDialog.Description>
              ) : (
                <RDialog.Description className="sr-only">{typeof title === 'string' ? title : 'Dialog'}</RDialog.Description>
              )}
            </div>
            <RDialog.Close className="-mt-1 -mr-1 rounded-md p-1.5 text-fg-subtle hover:bg-surface-2 hover:text-fg" aria-label="Close">
              <X className="size-4" />
            </RDialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}

/** Right-side drawer for editing records without leaving the current view. With mobile="bottom",
    it rises from the bottom edge as a sheet on phones (under 640 px) instead. */
export function Sheet({ open, onOpenChange, title, description, children, footer, className, width = 520, onEscapeKeyDown, mobile = 'side' }: BaseProps & { width?: number; onEscapeKeyDown?: (e: KeyboardEvent) => void; mobile?: 'side' | 'bottom' }) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-black/45" />
        <RDialog.Content
          style={{ width: `min(${width}px, 100vw)` }}
          onEscapeKeyDown={onEscapeKeyDown}
          className={cn(
            'fixed top-0 right-0 bottom-0 z-50 flex animate-slide-in-right flex-col border-l border-border bg-surface shadow-pop',
            mobile === 'bottom' && 'max-sm:top-auto max-sm:left-0 max-sm:max-h-[85dvh] max-sm:animate-slide-in-up max-sm:rounded-t-2xl max-sm:border-t max-sm:border-l-0',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <RDialog.Title className="text-[15px] leading-snug font-semibold tracking-[-0.01em] text-fg">{title}</RDialog.Title>
              {description ? (
                <RDialog.Description asChild>
                  <div className="mt-1.5 text-[13px] text-fg-subtle">{description}</div>
                </RDialog.Description>
              ) : (
                <RDialog.Description className="sr-only">{typeof title === 'string' ? title : 'Details'}</RDialog.Description>
              )}
            </div>
            <RDialog.Close className="-mt-1 -mr-1 rounded-md p-1.5 text-fg-subtle hover:bg-surface-2 hover:text-fg" aria-label="Close">
              <X className="size-4" />
            </RDialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}
