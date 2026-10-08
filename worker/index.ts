import { handleAdvisor, type AdvisorEnv } from '../server/advisor'

/* Cloudflare Worker for navigator.icarianforge.com.
   Static files (the built app in ./dist) are served by the assets binding;
   only /api/* reaches this code. Set ANTHROPIC_API_KEY with
   `npx wrangler secret put ANTHROPIC_API_KEY` to enable the live advisor. */

interface Env extends AdvisorEnv {
  ASSETS: { fetch(request: Request): Promise<Response> }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/api/advisor') {
      let body: unknown
      if (request.method === 'POST') {
        try {
          body = await request.json()
        } catch {
          body = undefined
        }
      }
      const r = await handleAdvisor(request.method, body, env)
      return Response.json(r.body, { status: r.status, headers: { 'Cache-Control': 'no-store' } })
    }
    if (url.pathname.startsWith('/api/')) return Response.json({ error: 'Not found' }, { status: 404 })
    return env.ASSETS.fetch(request)
  },
}
