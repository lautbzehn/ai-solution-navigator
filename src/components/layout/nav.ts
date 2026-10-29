/* The app's page names in one place, so the sidebar, breadcrumbs, and routes
   always agree. My Overview is about your own work; Portfolio is the one view
   of the whole portfolio (its route stays /reports, and /portfolio leads there). */

export const PAGES = {
  overview: { to: '/', label: 'My Overview' },
  solutions: { to: '/solutions', label: 'Solutions Hub' },
  portfolio: { to: '/reports', label: 'Portfolio' },
  framework: { to: '/framework', label: 'Lifecycle Framework' },
  settings: { to: '/settings', label: 'Settings' },
  about: { to: '/about', label: 'About this project' },
} as const

/** My Overview's sections, in page order. Their ids are the #anchors the sidebar links to. */
export const OVERVIEW_SECTIONS = [
  { id: 'attention', label: 'Needs your attention' },
  { id: 'work', label: 'My work' },
  { id: 'decisions', label: 'Decisions waiting' },
] as const

/** Other paths that lead to a page, keeping any query or #section. */
export const ROUTE_ALIASES: Record<string, string> = { portfolio: PAGES.portfolio.to }

/** The breadcrumb name for a URL's first segment ('' is My Overview). */
export const pageName = (segment: string) => Object.values(PAGES).find((p) => p.to === `/${segment}`)?.label
