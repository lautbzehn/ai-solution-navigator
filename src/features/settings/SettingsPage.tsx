import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { useShallow } from 'zustand/react/shallow'
import { ArrowRight, Database, Moon, RotateCcw, Sparkles, Sun } from 'lucide-react'
import { toast } from 'sonner'
import { useAdvisorStatus } from '@/ai/client'
import { Page, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Dialog'
import { Segmented } from '@/components/ui/misc'
import { Pill } from '@/components/ui/Pill'
import { lifecycle } from '@/config'
import { useStore } from '@/data/store'
import { useUI } from '@/data/ui'
import { cn } from '@/lib/cn'

export function SettingsPage() {
  const settings = useStore((s) => s.settings)
  const setAdvisorEnabled = useStore((s) => s.setAdvisorEnabled)
  const setAdvisorMode = useStore((s) => s.setAdvisorMode)
  const setTheme = useStore((s) => s.setTheme)
  const resetDemo = useStore((s) => s.resetDemo)
  const counts = useStore(useShallow((s) => ({ solutions: s.solutions.length, activities: s.activities.length, audit: s.audit.length })))
  const status = useAdvisorStatus()
  const [confirm, setConfirm] = useState(false)
  const navigate = useNavigate()
  const mode = settings.advisorMode ?? 'auto'
  const live = mode === 'auto' && status?.live

  const doReset = () => {
    resetDemo()
    useUI.setState({ conversations: {} })
    setConfirm(false)
    toast.success('Demo data reset', { description: 'The fictional Dunder Mifflin portfolio is back to its starting state.' })
    navigate('/')
  }

  return (
    <Page className="max-w-[880px]">
      <PageHeader title="Settings" subtitle="Demo data, the Implementation Advisor, appearance, and the lifecycle framework." />
      <div className="grid gap-4">
        <Section icon={<Database />} title="Demo data" description="Everything is stored privately in this browser, so your changes persist between refreshes and never reach other viewers. Resetting restores the starting portfolio.">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12.5px] text-fg-subtle tabular">{counts.solutions} solutions · {counts.activities} activities · {counts.audit} history entries</p>
            <Button variant="danger" onClick={() => setConfirm(true)}><RotateCcw /> Reset demo data</Button>
          </div>
        </Section>

        <Section icon={<Sparkles />} title="Implementation Advisor" description="A contextual advisor that analyzes the current solution, recommends the next action, and explains why. It never approves, changes lifecycle state, or makes legal or security determinations.">
          <div className="grid gap-4">
            <Row label="Advisor" hint="Shows the Advisor panel, the AI Advisor tab, and the 'Ask the advisor' shortcuts.">
              <Segmented label="Advisor" value={settings.advisorEnabled ? 'on' : 'off'} onChange={(v) => setAdvisorEnabled(v === 'on')} options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]} />
            </Row>
            <Row label="Mode" hint="Built-in guidance is deterministic, free, and works offline. Live mode uses Claude through a server route when the server has an API key.">
              <Segmented label="Advisor mode" value={mode} onChange={(v) => setAdvisorMode(v)} options={[{ value: 'auto', label: 'Live when available' }, { value: 'mock', label: 'Built-in only' }]} />
            </Row>
            <div className={cn('flex flex-wrap items-center gap-2 rounded-xl px-3.5 py-3 text-[12.5px] ring-1', live ? 'bg-success-soft/60 ring-success/20' : 'bg-surface-2 ring-border')}>
              <span className="text-fg-subtle">Current status</span>
              {status === undefined ? (
                <Pill tone="muted">Checking…</Pill>
              ) : live ? (
                <Pill tone="success" dot>Live · {status.model}</Pill>
              ) : (
                <Pill tone="accent" dot>Mock · built-in guidance</Pill>
              )}
              {!status?.live && mode === 'auto' && (
                <span className="text-fg-subtle">To enable live mode, set <code className="rounded bg-surface-3 px-1 py-0.5 font-mono text-[11.5px]">ANTHROPIC_API_KEY</code> on the server (see README). The key never reaches the browser.</span>
              )}
            </div>
          </div>
        </Section>

        <Section icon={settings.theme === 'dark' ? <Moon /> : <Sun />} title="Appearance" description="Dark is the primary theme; light is available for bright rooms and printing.">
          <Segmented label="Theme" value={settings.theme} onChange={(v) => setTheme(v)} options={[{ value: 'dark', label: <span className="flex items-center gap-1.5"><Moon className="size-3.5" />Dark</span> }, { value: 'light', label: <span className="flex items-center gap-1.5"><Sun className="size-3.5" />Light</span> }]} />
        </Section>

        <Section title="Lifecycle framework" description={`${lifecycle.name} v${lifecycle.version}: ${lifecycle.stages.length} stages, ${lifecycle.activityTemplates.length} activity templates, ${lifecycle.evidenceTemplates.length} evidence types, ${lifecycle.riskTiers.length} risk tiers, and ${lifecycle.readinessDimensions.length} readiness dimensions.`}>
          <Button variant="secondary" className="h-auto py-2 text-left whitespace-normal" asChild><Link to="/framework">View stages, gates, risk tiers, and readiness weights <ArrowRight /></Link></Button>
        </Section>
      </div>

      <Modal
        open={confirm}
        onOpenChange={setConfirm}
        size="sm"
        title="Reset demo data?"
        description="All solutions, activities, evidence, risks, decisions, metrics, and history in this browser will return to the starting demo portfolio. This can't be undone."
        footer={<><Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button><Button variant="danger" onClick={doReset}>Reset demo data</Button></>}
      >
        <p className="text-[13px] text-fg-muted">Your theme preference is kept. Readiness weights return to their defaults.</p>
      </Modal>
    </Page>
  )
}

function Section({ icon, title, description, children }: { icon?: ReactNode; title: string; description: string; children: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start gap-3">
        {icon && <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-fg-muted ring-1 ring-border [&_svg]:size-4">{icon}</span>}
        <div>
          <h2 className="text-[14.5px] font-semibold text-fg">{title}</h2>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-fg-subtle">{description}</p>
        </div>
      </div>
      {children}
    </Card>
  )
}

function Row({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="max-w-md">
        <p className="text-[13px] font-medium text-fg">{label}</p>
        <p className="text-[12px] text-fg-subtle">{hint}</p>
      </div>
      {children}
    </div>
  )
}
