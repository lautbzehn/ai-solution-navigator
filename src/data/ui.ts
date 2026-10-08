import { create } from 'zustand'
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
  /** A question queued for the advisor panel (e.g. from a "Ask the advisor" button). */
  advisorPrompt?: string
  toggleSidebar(): void
  setMobileNav(v: boolean): void
  setPalette(v: boolean): void
  setCreate(v: boolean): void
  setAdvisor(v: boolean, prompt?: string): void
  consumeAdvisorPrompt(): string | undefined
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
  setAdvisor: (advisorOpen, advisorPrompt) => set({ advisorOpen, advisorPrompt }),
  consumeAdvisorPrompt() {
    const p = get().advisorPrompt
    if (p) set({ advisorPrompt: undefined })
    return p
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
