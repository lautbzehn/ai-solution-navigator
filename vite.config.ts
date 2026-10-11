import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { handleAdvisor } from './server/advisor'
import { clientIdFor } from './server/guard'

/** Serves /api/advisor in development with the same handler the Cloudflare Worker uses in production. */
function advisorApi(): Plugin {
  return {
    name: 'advisor-api',
    configureServer(server) {
      server.middlewares.use('/api/advisor', (req, res) => {
        let raw = ''
        req.on('data', (chunk) => (raw += chunk))
        req.on('end', async () => {
          let body: unknown
          try {
            body = raw ? JSON.parse(raw) : undefined
          } catch {
            body = undefined
          }
          const header = (name: string) => {
            const v = req.headers[name]
            return Array.isArray(v) ? v[0] : v
          }
          const result = await handleAdvisor(req.method ?? 'GET', body, undefined, {
            meta: { origin: header('origin'), clientHeader: header('x-navigator-client'), clientId: await clientIdFor(req.socket.remoteAddress ?? 'local'), bodyBytes: Buffer.byteLength(raw) },
          })
          res.statusCode = result.status
          for (const [k, v] of Object.entries(result.headers ?? {})) res.setHeader(k, v)
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(result.body))
        })
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // Make server-only secrets (ANTHROPIC_API_KEY, ADVISOR_MODEL) from .env visible to the dev API.
  const env = loadEnv(mode, process.cwd(), '')
  for (const key of ['ANTHROPIC_API_KEY', 'ADVISOR_MODEL']) if (env[key] && !process.env[key]) process.env[key] = env[key]
  return {
    plugins: [react(), tailwindcss(), advisorApi()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
  }
})
