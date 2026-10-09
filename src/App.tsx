import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { Toaster, toast } from 'sonner'
import { AppShell } from '@/components/layout/AppShell'
import { RouteError } from '@/components/layout/RouteError'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { useStore } from '@/data/store'
import { onStorageError } from '@/data/storage'
import { PageSkeleton } from '@/components/layout/PageSkeleton'
import { NotFoundPage } from '@/features/NotFoundPage'

// Route-level code splitting keeps the first load small.
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const SolutionsPage = lazy(() => import('@/features/solutions/SolutionsPage').then((m) => ({ default: m.SolutionsPage })))
const WorkspacePage = lazy(() => import('@/features/workspace/WorkspacePage').then((m) => ({ default: m.WorkspacePage })))
const ReportsPage = lazy(() => import('@/features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })))
const FrameworkPage = lazy(() => import('@/features/framework/FrameworkPage').then((m) => ({ default: m.FrameworkPage })))
const AboutPage = lazy(() => import('@/features/about/AboutPage').then((m) => ({ default: m.AboutPage })))
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })))

const page = (el: ReactNode) => <Suspense fallback={<PageSkeleton />}>{el}</Suspense>

const router = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: page(<DashboardPage />) },
      { path: 'solutions', element: page(<SolutionsPage />) },
      { path: 'solutions/:id/:tab?', element: page(<WorkspacePage />) },
      { path: 'reports', element: page(<ReportsPage />) },
      { path: 'framework', element: page(<FrameworkPage />) },
      { path: 'settings', element: page(<SettingsPage />) },
      { path: 'about', element: page(<AboutPage />) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

export function App() {
  const theme = useStore((s) => s.settings.theme)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])
  useEffect(() => {
    const off = onStorageError((msg) => toast.error(msg))
    return () => {
      off()
    }
  }, [])
  return (
    <TooltipProvider>
      <RouterProvider router={router} />
      <Toaster
        theme={theme}
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast: '!bg-surface-2 !text-fg !border-border-strong !shadow-pop !rounded-xl',
            description: '!text-fg-subtle',
          },
        }}
      />
    </TooltipProvider>
  )
}
