// Vercel Serverless Function: Gemini generateContent proxy
export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || ''
    const model = process.env.GEMINI_MODEL || process.env.VITE_GEMINI_MODEL || 'gemini-2.0-flash'
    if (!apiKey) return json({ error: 'GEMINI_API_KEY is not configured' }, 500)
    const body = await req.text()
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
    if (!r.ok) {
      const err = await r.text().catch(() => '')
      return json({ error: 'Gemini error', details: err }, r.status)
    }
    const text = await r.text()
    return new Response(text, { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500)
  }
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })
}


