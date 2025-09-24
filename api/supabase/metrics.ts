export const config = { runtime: 'edge' }

import { createClient } from '@supabase/supabase-js'

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL || ''
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return new Response('Supabase env missing', { status: 500 })

    const body = await req.json()
    const {
      candidate_id,
      session_id,
      ts,
      face_present,
      in_frame_ratio,
      gaze_in_screen,
      lighting_ok,
      image_quality_score,
      privacy_events,
      raw_key,
    } = body || {}
    if (!candidate_id || !session_id) return new Response('candidate_id and session_id are required', { status: 400 })

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const payload = {
      candidate_id,
      session_id,
      ts: ts || new Date().toISOString(),
      face_present: face_present ?? null,
      in_frame_ratio: in_frame_ratio ?? null,
      gaze_in_screen: gaze_in_screen ?? null,
      lighting_ok: lighting_ok ?? null,
      image_quality_score: image_quality_score ?? null,
      privacy_events: privacy_events ?? null,
      raw_key: raw_key ?? null,
    }
    const ins = await supabase.from('interview_metrics').insert(payload)
    if (ins.error) return new Response(ins.error.message, { status: 500 })

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (e: any) {
    return new Response(String(e?.message || e), { status: 500 })
  }
}


