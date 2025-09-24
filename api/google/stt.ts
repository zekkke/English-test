export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } })
  try {
    const key = process.env.GOOGLE_STT_API_KEY || process.env.VITE_GOOGLE_STT_API_KEY || ''
    if (!key) return new Response(JSON.stringify({ error: 'GOOGLE_STT_API_KEY not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    const body = await req.text()
    const r = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${key}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
    })
    const text = await r.text()
    return new Response(text, { status: r.status, headers: { 'Content-Type': 'application/json' } })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}


