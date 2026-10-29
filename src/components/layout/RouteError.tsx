import { Link, useRouteError } from 'react-router'
import { TriangleAlert } from 'lucide-react'
import { Button } from '../ui/Button'

/** Friendly error boundary: never a raw stack trace. */
export function RouteError() {
  const error = useRouteError()
  if (import.meta.env.DEV) console.error(error)
  return (
    <div className="grid min-h-dvh place-items-center bg-bg p-6">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 grid size-11 place-items-center rounded-xl bg-danger-soft text-danger-fg ring-1 ring-danger/25">
          <TriangleAlert className="size-5" />
        </div>
        <h1 className="text-[17px] font-semibold text-fg">Something went wrong on this screen</h1>
        <p className="mt-2 text-[13.5px] text-fg-subtle">Your data is safe. Try going back to the dashboard. If this keeps happening, resetting the demo data in Settings will restore a clean state.</p>
        <div className="mt-5 flex justify-center gap-2">
          <Button variant="secondary" onClick={() => window.location.reload()}>Reload</Button>
          <Button variant="primary" asChild><Link to="/">Back to dashboard</Link></Button>
        </div>
      </div>
    </div>
  )
}
