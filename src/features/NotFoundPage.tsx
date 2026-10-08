import { Link } from 'react-router'
import { Compass } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/misc'

export function NotFoundPage({ title = 'Page not found', body = "The page you're looking for doesn't exist or was moved." }: { title?: string; body?: string }) {
  return (
    <div className="mx-auto max-w-xl px-6 py-20">
      <EmptyState icon={<Compass />} title={title} body={body} action={<Button variant="secondary" asChild><Link to="/solutions">View all solutions</Link></Button>} />
    </div>
  )
}
