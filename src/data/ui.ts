import { create } from 'zustand'
import type { AdvisorArea } from '@/ai/areas'
import type { AdvisorTurn } from '@/ai/types'

/* Ephemeral UI state. Sidebar preference is a per-viewer convenience. */

const readCollapsed = () => {
  try {
    return window.localStorage.getItem('asn-sidebar') === 'collapsed'
  } catch {
    return false
  }
}

interface UIState {
  sidebarCollapsed: boolean
  mobileNavOpen: boolean
  paletteOpen: boolean
  createOpen: boolean
  advisorOpen: boolean
  helpOpen: boolean
  tourOpen: boolean
  setHelp(v: boolean): void
  startTour(): void
  endTour(): void
  /** A question queued for the advisor panel, e.g. from a star icon. The id makes repeat clicks count. */
  advisorRequest?: { id: number; question: string; area?: AdvisorArea }
  toggleSidebar(): void
  setMobileNav(v: boolean): void
  setPalette(v: boolean): void
  setCreate(v: boolean): void
  setAdvisor(v: boolean): void
  /** Open the advisor panel and ask a question, optionally pinned to one area of the screen. */
  askAdvisor(question: string, area?: AdvisorArea): void
  consumeAdvisorRequest(): UIState['advisorRequest']
  /** Advisor conversations, keyed by context ("solution:<id>" or "portfolio"). In-memory only. */
  conversations: Record<string, AdvisorTurn[]>
  pushTurn(key: string, turn: AdvisorTurn): void
  clearConversation(key: string): void
}

export const useUI = create<UIState>((set, get) => ({
  sidebarCollapsed: readCollapsed(),
  mobileNavOpen: false,
  paletteOpen: false,
  createOpen: false,
  advisorOpen: false,
  helpOpen: false,
  tourOpen: false,
  setHelp: (helpOpen) => set({ helpOpen }),
  // The tour needs a clear stage: close anything that could cover what it points at.
  startTour: () => set({ tourOpen: true, helpOpen: false, advisorOpen: false, paletteOpen: false, mobileNavOpen: false }),
  endTour: () => set({ tourOpen: false }),
  toggleSidebar() {
    const next = !get().sidebarCollapsed
    try {
      window.localStorage.setItem('asn-sidebar', next ? 'collapsed' : 'expanded')
    } catch {
      /* ignore */
    }
    set({ sidebarCollapsed: next })
  },
  setMobileNav: (mobileNavOpen) => set({ mobileNavOpen }),
  setPalette: (paletteOpen) => set({ paletteOpen }),
  setCreate: (createOpen) => set({ createOpen }),
  setAdvisor: (advisorOpen) => set({ advisorOpen }),
  askAdvisor: (question, area) => set({ advisorOpen: true, advisorRequest: { id: (get().advisorRequest?.id ?? 0) + 1, question, area } }),
  consumeAdvisorRequest() {
    const r = get().advisorRequest
    if (r) set({ advisorRequest: undefined })
    return r
  },
  conversations: {},
  pushTurn(key, turn) {
    set({ conversations: { ...get().conversations, [key]: [...(get().conversations[key] ?? []), turn] } })
  },
  clearConversation(key) {
    const next = { ...get().conversations }
    delete next[key]
    set({ conversations: next })
  },
}))
