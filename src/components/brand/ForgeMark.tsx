import { cn } from '@/lib/cn'

/* "An Icarian Forge product", shared with every Icarian Forge product: the I and
   Forge in Icarian Forge amber at normal weight, everything else in the
   surrounding text color. Links to the studio. */
export function ForgeMark({ className }: { className?: string }) {
  return (
    <a
      href="https://www.icarianforge.com"
      target="_blank"
      rel="noopener"
      className={cn('whitespace-nowrap transition-colors hover:text-fg [&_b]:font-normal [&_b]:text-forge', className)}
    >
      <ForgeLogo />
      An{' '}
      <span className="ifp">
        <b>I</b>carian <b>Forge</b>
      </span>{' '}
      product
    </a>
  )
}

/* The Icarian Forge logo, as on icarianforge.com. Its light pulses from the
   Icarian Forge amber to emerald and back (index.css, .if-logo). */
function ForgeLogo() {
  return (
    <svg className="if-logo" viewBox="0 0 32 32" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
        <path d="M3 21c7-.6 12.5-4.6 16-11" />
        <path d="M6 25.5c7.8-.6 14-4.8 18-12" />
        <path d="M11 29.5c6.5-.7 11.6-4.2 15-10" />
      </g>
      <circle className="sun" cx="25.5" cy="6.5" r="3.8" />
    </svg>
  )
}

/** One quiet line at the foot of every view. */
export function ForgeFooter() {
  return (
    <footer className="px-4 pt-2 pb-6 text-center text-[11.5px] text-fg-faint md:px-8">
      <ForgeMark /> · © 2026 Icarian Forge. All rights reserved.
    </footer>
  )
}
