export const config = { runtime: 'edge' }

import { createClient } from '@supabase/supabase-js'

type Body = {
  candidate_id: string
  session_id: string
  ts?: string
  kind: 'partial' | 'final' | 'error' | 'info'
  text?: string
  meta?: unknown
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL || ''
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return new Response('Supabase env missing', { status: 500 })

    const payload: Body = await req.json()
    const { candidate_id, session_id, kind, text, meta } = payload || ({} as Body)
    if (!candidate_id || !session_id || !kind) return new Response('candidate_id, session_id and kind are required', { status: 400 })

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const row = {
      candidate_id,
      session_id,
      ts: payload.ts || new Date().toISOString(),
      kind,
      text: text ?? null,
      meta: meta ?? null,
    }
    const ins = await supabase.from('speech_logs').insert(row)
    if (ins.error) return new Response(ins.error.message, { status: 500 })
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (e: any) {
    return new Response(String(e?.message || e), { status: 500 })
  }
}


