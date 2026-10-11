export const DAY = 86_400_000

/** Whole days from an ISO timestamp until `now` (never negative). */
export const daysSince = (iso: string, now = Date.now()) => Math.max(0, Math.round((now - new Date(iso).getTime()) / DAY))
