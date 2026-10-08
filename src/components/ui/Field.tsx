import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { ChevronDown, CircleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'

const CONTROL =
  'w-full rounded-lg bg-bg-subtle px-3 text-[13.5px] text-fg ring-1 ring-inset ring-border-strong transition-shadow placeholder:text-fg-faint hover:ring-fg-faint focus:ring-2 focus:ring-ring focus:outline-none disabled:opacity-60 aria-[invalid=true]:ring-danger/60'

/** Label + control + inline hint/error. Errors are announced and linked via aria-describedby. */
export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
  optionalLabel,
}: {
  label: ReactNode
  hint?: ReactNode
  error?: string
  required?: boolean
  optionalLabel?: boolean
  className?: string
  children: (props: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => ReactNode
}) {
  const id = useId()
  const descId = `${id}-desc`
  return (
    <div className={cn('grid gap-1.5', className)}>
      <label htmlFor={id} className="flex items-center gap-1 text-[12.5px] font-medium text-fg-muted">
        {label}
        {required && <span className="text-danger-fg" aria-hidden>*</span>}
        {optionalLabel && <span className="font-normal text-fg-faint">(optional)</span>}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': error || hint ? descId : undefined })}
      {error ? (
        <p id={descId} role="alert" className="flex items-center gap-1.5 text-[12px] text-danger-fg">
          <CircleAlert className="size-3.5 shrink-0" /> {error}
        </p>
      ) : hint ? (
        <p id={descId} className="text-[12px] text-fg-subtle">{hint}</p>
      ) : null}
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(CONTROL, 'h-9', className)} {...rest} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, rows = 3, ...rest }, ref) {
  return <textarea ref={ref} rows={rows} className={cn(CONTROL, 'resize-y py-2 leading-relaxed', className)} {...rest} />
})

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(CONTROL, 'h-9 appearance-none pr-8', className)} {...rest}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-fg-subtle" />
    </div>
  )
})

/** Compact select used in toolbars and filters. */
export function FilterSelect({ label, value, onChange, options, className }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-8 appearance-none rounded-lg bg-surface pr-7 pl-2.5 text-[12.5px] ring-1 ring-inset ring-border-strong transition-colors hover:bg-surface-2 focus:ring-2 focus:ring-ring focus:outline-none',
          value ? 'text-fg' : 'text-fg-muted',
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-fg-subtle" />
    </div>
  )
}
