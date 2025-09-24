// Vercel Serverless Function: ElevenLabs TTS proxy for production
// Reads JSON { text } and responds with audio/mpeg stream

export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } })

  try {
    // Надійне читання тіла запиту
    const raw = await req.text()
    const parsed = raw ? safeParseJSON(raw) : {}
    const { text } = (parsed || {}) as { text?: string }
    if (!text || !text.trim()) return json({ error: 'Missing text' }, 400)

    const apiKey = process.env.ELEVEN_API_KEY || process.env.VITE_ELEVEN_API_KEY || ''
    const voice = process.env.ELEVEN_VOICE || process.env.VITE_ELEVEN_VOICE || '21m00Tcm4TlvDq8ikWAM'
    if (!apiKey) return json({ error: 'ELEVEN_API_KEY is not configured' }, 500)

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice}/stream?optimize_streaming_latency=4`
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'accept': 'audio/mpeg',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }),
    })
    if (!r.ok) {
      const errText = await r.text().catch(() => '')
      return json({ error: 'ElevenLabs error', details: errText }, r.status)
    }
    const ab = await r.arrayBuffer()
    return new Response(ab, { status: 200, headers: { 'Content-Type': 'audio/mpeg' } })
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500)
  }
}

function safeParseJSON(s: string): any {
  try { return JSON.parse(s) } catch { return {} }
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })
}


