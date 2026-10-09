import { Star } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '@/data/store'
import { cn } from '@/lib/cn'
import { Tip } from './ui/Tooltip'

/** A yellow star that pins a solution to the user's Favorites in the sidebar. */
export function FavoriteStar({ solutionId, name, className, size = 'sm' }: { solutionId: string; name: string; className?: string; size?: 'sm' | 'md' }) {
  const fav = useStore((s) => (s.settings.favorites ?? []).includes(solutionId))
  const toggle = useStore((s) => s.toggleFavorite)
  return (
    <Tip content={fav ? 'Remove from your favorites' : 'Add to your favorites, pinned in the sidebar'}>
      <button
        type="button"
        aria-pressed={fav}
        aria-label={fav ? `Remove ${name} from favorites` : `Add ${name} to favorites`}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          toggle(solutionId)
          toast(fav ? 'Removed from favorites' : 'Added to favorites', { description: fav ? undefined : 'It is pinned under Favorites in the sidebar.' })
        }}
        className={cn(
          'grid shrink-0 place-items-center rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
          size === 'sm' ? 'size-6' : 'size-8',
          fav ? 'text-star hover:bg-surface-2' : 'text-fg-faint hover:bg-surface-2 hover:text-star',
          className,
        )}
      >
        <Star className={cn(size === 'sm' ? 'size-3.5' : 'size-[18px]', fav && 'fill-current')} strokeWidth={1.8} />
      </button>
    </Tip>
  )
}
