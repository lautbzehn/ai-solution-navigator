import { afterEach, expect, test } from 'vitest'
import { handleAdvisor } from '../advisor'

const ctx = { kind: 'portfolio', solutions: [], insights: [] }

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY
})

test('reports mock mode and refuses live calls without a server key', async () => {
  expect((await handleAdvisor('GET', undefined)).body).toEqual({ live: false })
  expect((await handleAdvisor('POST', { question: 'hi', context: ctx })).status).toBe(503)
})

test('rejects empty questions and malformed context', async () => {
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test-invalid'
  expect((await handleAdvisor('POST', { question: '  ', context: ctx })).status).toBe(400)
  expect((await handleAdvisor('POST', { question: 'hi', context: { kind: 'x' } })).status).toBe(400)
})

test('an invalid key degrades to a friendly 503, never a stack trace', async () => {
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test-invalid'
  const r = await handleAdvisor('POST', { question: 'What should I do next?', context: ctx })
  expect(r.status).toBe(503)
  expect(JSON.stringify(r.body)).not.toMatch(/at .*\.ts:\d+/)
  console.log('live error body:', r.body)
}, 30000)
