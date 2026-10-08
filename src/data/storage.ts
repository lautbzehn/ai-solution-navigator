import type { StateStorage } from 'zustand/middleware'

/* Persistence adapter
   -------------------
   The POC persists to the browser so every visitor gets a private sandbox and
   the demo never mixes data between viewers. The store only talks to this
   StateStorage interface, so swapping in SQLite or a REST API later is a
   one-file change. Failures surface as a friendly message, never a stack trace. */

type Listener = (message: string) => void
const listeners = new Set<Listener>()
export const onStorageError = (fn: Listener) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
const emit = (message: string) => listeners.forEach((fn) => fn(message))

export const SAVE_ERROR = "We couldn't save this change. Please try again."

export const safeLocalStorage: StateStorage = {
  getItem(name) {
    try {
      return window.localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem(name, value) {
    try {
      window.localStorage.setItem(name, value)
    } catch {
      emit(SAVE_ERROR)
    }
  },
  removeItem(name) {
    try {
      window.localStorage.removeItem(name)
    } catch {
      /* ignore */
    }
  },
}
