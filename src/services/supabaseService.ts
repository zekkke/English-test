import { getSupabaseClient } from '../lib/supabaseClient.ts'

export type InterviewMetrics = {
  id?: string
  candidate_id: string
  session_id: string
  ts?: string
  face_present?: boolean
  in_frame_ratio?: number
  gaze_in_screen?: number
  lighting_ok?: boolean
  image_quality_score?: number
  privacy_events?: unknown
  raw_key?: string
  created_at?: string
}

const USE_BACKEND = (import.meta as any).env.VITE_USE_BACKEND_FOR_SUPABASE === 'true'

// Photo upload removed: we do not store images/biometrics anymore

export async function insertInterviewMetrics(row: InterviewMetrics) {
  if (USE_BACKEND) {
    const r = await fetch('/api/supabase/metrics', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(row)
    })
    if (!r.ok) throw new Error(`metrics failed: ${r.status}`)
    return
  }
  const supabase = getSupabaseClient()
  const payload = {
    candidate_id: row.candidate_id,
    session_id: row.session_id,
    ts: row.ts ?? new Date().toISOString(),
    face_present: row.face_present ?? null,
    in_frame_ratio: row.in_frame_ratio ?? null,
    gaze_in_screen: row.gaze_in_screen ?? null,
    lighting_ok: row.lighting_ok ?? null,
    image_quality_score: row.image_quality_score ?? null,
    privacy_events: row.privacy_events ?? null,
    raw_key: row.raw_key ?? null,
  }
  const { error } = await supabase.from('interview_metrics').insert(payload)
  if (error) throw error
}

export type SpeechLogRow = {
  candidate_id: string
  session_id: string
  ts?: string
  kind: 'partial' | 'final' | 'error' | 'info'
  text?: string
  meta?: unknown
}

export async function insertSpeechLog(row: SpeechLogRow) {
  if (USE_BACKEND) {
    const r = await fetch('/api/supabase/speech-log', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(row)
    })
    if (!r.ok) throw new Error(`speech-log failed: ${r.status}`)
    return
  }
  const supabase = getSupabaseClient()
  const payload = {
    candidate_id: row.candidate_id,
    session_id: row.session_id,
    ts: row.ts ?? new Date().toISOString(),
    kind: row.kind,
    text: row.text ?? null,
    meta: row.meta ?? null,
  }
  const { error } = await supabase.from('speech_logs').insert(payload)
  if (error) throw error
}