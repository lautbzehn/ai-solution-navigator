import { useCallback, useState } from 'react'
import type { Errors } from '@/domain/validation'

/** Minimal form state: values, inline errors that clear as the user edits. */
export function useForm<T extends Record<string, unknown>>(initial: T) {
  const [values, setValues] = useState<T>(initial)
  const [errors, setErrors] = useState<Errors<Extract<keyof T, string>>>({})
  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((v) => ({ ...v, [key]: value }))
    setErrors((e) => (e[key as unknown as Extract<keyof T, string>] ? { ...e, [key]: undefined } : e))
  }, [])
  const reset = useCallback((next: T = initial) => {
    setValues(next)
    setErrors({})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return { values, set, errors, setErrors, reset }
}
