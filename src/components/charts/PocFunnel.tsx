import { Tip } from '@/components/ui/Tooltip'
import { cn } from '@/lib/cn'

export interface FunnelStep {
  key: string
  label: string
  count: number
  hint: string
}

/** How many ideas reached each step of the lifecycle. One hue, thin bars
    anchored at the left, the count beside each bar, and the share that carried
    on between steps, so the drop-off is the picture. */
export function PocFunnel({ steps, onSelect, className }: { steps: FunnelStep[]; onSelect?: (key: string) => void; className?: string }) {
  const max = Math.max(1, ...steps.map((s) => s.count))
  return (
    <div className={className}>
      <ol className="grid gap-1" aria-hidden>
        {steps.map((s, i) => {
          const prev = steps[i - 1]
          const carried = prev && prev.count ? Math.round((s.count / prev.count) * 100) : undefined
          const Row = onSelect ? 'button' : 'div'
          return (
            <li key={s.key}>
              {carried !== undefined && <p className="py-0.5 pl-[96px] text-[11px] text-fg-faint tabular">↓ {carried}% carried on</p>}
              <Tip content={<><b className="font-semibold">{s.label}: {s.count}</b> · {s.hint}</>} side="top">
                <Row
                  {...(onSelect ? { type: 'button' as const, onClick: () => onSelect(s.key) } : {})}
                  className={cn('grid w-full grid-cols-[88px_minmax(0,1fr)] items-center gap-2 rounded-md py-1 text-left', onSelect && 'hover:bg-surface-2')}
                >
                  <span className="truncate pl-1 text-[12.5px] font-medium text-fg-muted">{s.label}</span>
                  <span className="flex items-center gap-2">
                    <span className="h-3 flex-1 overflow-hidden rounded-[4px] bg-surface-3">
                      <span className="block h-full rounded-[4px] bg-accent transition-[width] duration-700 ease-out" style={{ width: `${(s.count / max) * 100}%` }} />
                    </span>
                    <span className="w-6 text-right text-[13px] font-semibold text-fg tabular">{s.count}</span>
                  </span>
                </Row>
              </Tip>
            </li>
          )
        })}
      </ol>
      <table className="sr-only">
        <caption>Proof of concept funnel</caption>
        <thead>
          <tr><th>Step</th><th>Solutions</th><th>Meaning</th></tr>
        </thead>
        <tbody>
          {steps.map((s) => (
            <tr key={s.key}><td>{s.label}</td><td>{s.count}</td><td>{s.hint}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
