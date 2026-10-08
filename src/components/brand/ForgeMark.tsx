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
      An{' '}
      <span className="ifp">
        <b>I</b>carian <b>Forge</b>
      </span>{' '}
      product
    </a>
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
