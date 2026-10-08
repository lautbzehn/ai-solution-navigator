import { handleAdvisor } from '../server/advisor'

/* Vercel serverless function: GET /api/advisor (status), POST /api/advisor (ask).
   Set ANTHROPIC_API_KEY in the Vercel project to enable live mode. */

export async function GET() {
  const r = await handleAdvisor('GET', undefined)
  return Response.json(r.body, { status: r.status })
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Ask a question about the current solution.' }, { status: 400 })
  }
  const r = await handleAdvisor('POST', body)
  return Response.json(r.body, { status: r.status })
}
