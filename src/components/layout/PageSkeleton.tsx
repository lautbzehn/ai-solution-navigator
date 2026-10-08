/** Loading placeholder shown while a route's code loads. */
export function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-8 md:px-8" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-8 w-72 rounded-lg" />
      <div className="skeleton mt-3 h-4 w-96 max-w-full rounded" />
      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-32 rounded-xl" />)}
      </div>
      <div className="skeleton mt-4 h-72 rounded-xl" />
    </div>
  )
}
