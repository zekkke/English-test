export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } })
  try {
    const key = process.env.ASSEMBLYAI_API_KEY || process.env.VITE_ASSEMBLYAI_API_KEY || ''
    if (!key) return new Response(JSON.stringify({ error: 'ASSEMBLYAI_API_KEY not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    const r = await fetch('https://api.assemblyai.com/v2/realtime/token', { method: 'POST', headers: { Authorization: key } })
    const text = await r.text()
    return new Response(text, { status: r.status, headers: { 'Content-Type': 'application/json' } })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}


