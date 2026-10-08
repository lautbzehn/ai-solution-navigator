import { useState } from 'react'
import { UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Dialog'
import { Field, Select } from '@/components/ui/Field'
import { Pill } from '@/components/ui/Pill'
import { Tip } from '@/components/ui/Tooltip'
import { gateFor, lifecycle, roleName } from '@/config'
import { useStore } from '@/data/store'
import { cn } from '@/lib/cn'
import { useWorkspace } from '../context'

export function TeamTab() {
  const { insight, goTab } = useWorkspace()
  const { bundle } = insight
  const { solution } = bundle
  const people = useStore((s) => s.people)
  const setTeam = useStore((s) => s.setTeam)
  const [adding, setAdding] = useState<string | null>(null)

  const gateRoles = new Set(lifecycle.gates.flatMap((g) => g.criteria.flatMap((c) => (c.type === 'role' ? c.roles : []))))
  const currentGateRoles = new Set((gateFor(solution.stage)?.criteria ?? []).flatMap((c) => (c.type === 'role' ? c.roles : [])))

  const stats = (pid: string) => {
    const owned = bundle.activities.filter((a) => a.ownerId === pid && a.required)
    return {
      owned: owned.length,
      open: owned.filter((a) => a.status !== 'complete' && a.status !== 'not_applicable').length,
      blocking: owned.filter((a) => a.blocking && a.stage === solution.stage && a.status !== 'complete').length,
      contributing: bundle.activities.filter((a) => a.contributorIds.includes(pid)).length,
    }
  }

  const remove = (personId: string, roleId: string) => {
    const owned = bundle.activities.filter((a) => a.ownerId === personId && a.status !== 'complete').length
    setTeam(solution.id, solution.team.filter((m) => !(m.personId === personId && m.roleId === roleId)))
    toast(`${people.find((p) => p.id === personId)?.name} removed as ${roleName(roleId)}`, { description: owned ? `They still own ${owned} open activities. Reassign them from the Work tab.` : undefined })
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-[13px] text-fg-muted">The PM orchestrates; specialists own the work. Every activity names one accountable owner.</p>
        <Button variant="primary" size="sm" className="ml-auto" onClick={() => setAdding('')}><UserPlus /> Add team member</Button>
      </div>
      <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        {lifecycle.roles.map((role) => {
          const members = solution.team.filter((m) => m.roleId === role.id)
          if (!members.length && role.id === 'other') return null
          const neededNow = currentGateRoles.has(role.id)
          return (
            <Card key={role.id} className={cn('flex flex-col p-4', !members.length && neededNow && 'ring-danger/35')}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="flex flex-wrap items-center gap-1.5 text-[13.5px] font-semibold text-fg">
                    {role.name}
                    {gateRoles.has(role.id) && <Tip content="A stage gate requires this role to be assigned"><span><Pill tone={neededNow && !members.length ? 'danger' : 'muted'} className="h-[18px] px-1.5 text-[10.5px]">Gate role</Pill></span></Tip>}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-fg-subtle">{role.responsibilities}</p>
                </div>
              </div>
              <div className="mt-3 grid flex-1 content-start gap-2">
                {members.length ? (
                  members.map((m) => {
                    const p = people.find((x) => x.id === m.personId)
                    const s = stats(m.personId)
                    return (
                      <div key={m.personId} className="flex items-center gap-2.5 rounded-lg bg-surface-2 px-2.5 py-2 ring-1 ring-border">
                        <Avatar person={p} size="md" tip={false} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-fg">{p?.name}</p>
                          <p className="truncate text-[11.5px] text-fg-subtle">{p?.title}</p>
                          <p className="mt-0.5 text-[11.5px] text-fg-muted tabular">
                            <button className="hover:underline" onClick={() => goTab('work')}>{s.open} open of {s.owned} owned</button>
                            {s.blocking > 0 && <span className="text-warning-fg"> · {s.blocking} blocking now</span>}
                            {s.contributing > 0 && <span className="text-fg-subtle"> · contributes to {s.contributing}</span>}
                          </p>
                        </div>
                        <Tip content={`Remove from ${role.name}`}>
                          <Button variant="ghost" size="icon-sm" aria-label={`Remove ${p?.name} from ${role.name}`} onClick={() => remove(m.personId, m.roleId)}><X className="!size-3.5" /></Button>
                        </Tip>
                      </div>
                    )
                  })
                ) : (
                  <div className={cn('flex items-center justify-between gap-2 rounded-lg border border-dashed px-2.5 py-2', neededNow ? 'border-danger/40 bg-danger-soft/50' : 'border-border-strong')}>
                    <span className={cn('text-[12.5px]', neededNow ? 'text-danger-fg' : 'text-fg-subtle')}>{neededNow ? 'Unassigned: required for the current gate' : 'Unassigned'}</span>
                    <Button variant="ghost" size="xs" onClick={() => setAdding(role.id)}>Assign</Button>
                  </div>
                )}
              </div>
            </Card>
          )
        })}
      </div>
      <AddMemberModal roleId={adding} onClose={() => setAdding(null)} />
    </div>
  )
}

function AddMemberModal({ roleId, onClose }: { roleId: string | null; onClose: () => void }) {
  const { insight } = useWorkspace()
  const { solution } = insight.bundle
  const people = useStore((s) => s.people)
  const setTeam = useStore((s) => s.setTeam)
  const [personId, setPersonId] = useState('')
  const [role, setRole] = useState('')
  const [errors, setErrors] = useState<{ person?: string; role?: string }>({})
  const open = roleId !== null

  const submit = () => {
    const r = role || roleId || ''
    const e = { person: personId ? undefined : 'Choose a person.', role: r ? undefined : 'Choose a role.' }
    if (!e.person && !e.role && solution.team.some((m) => m.personId === personId && m.roleId === r)) e.role = 'This person already holds that role.'
    if (e.person || e.role) return setErrors(e)
    setTeam(solution.id, [...solution.team, { personId, roleId: r }])
    toast.success(`${people.find((p) => p.id === personId)?.name} added as ${roleName(r)}`)
    setPersonId('')
    setRole('')
    setErrors({})
    onClose()
  }

  return (
    <Modal
      open={open}
      onOpenChange={(o) => { if (!o) { setErrors({}); onClose() } }}
      size="sm"
      title="Add team member"
      description="Assign a person to a lifecycle role on this solution. People can hold more than one role."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={submit}>Add to team</Button></>}
    >
      <div className="grid gap-4">
        <Field label="Person" required error={errors.person}>
          {(p) => (
            <Select {...p} value={personId} onChange={(e) => { setPersonId(e.target.value); setErrors((x) => ({ ...x, person: undefined })) }}>
              <option value="">Select a person…</option>
              {people.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.title}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Role" required error={errors.role}>
          {(p) => (
            <Select {...p} value={role || roleId || ''} onChange={(e) => { setRole(e.target.value); setErrors((x) => ({ ...x, role: undefined })) }}>
              <option value="">Select a role…</option>
              {lifecycle.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </Select>
          )}
        </Field>
      </div>
    </Modal>
  )
}
