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

const STORAGE_BUCKET = (import.meta as any).env.VITE_SUPABASE_STORAGE_BUCKET || 'English test'
const USE_BACKEND = (import.meta as any).env.VITE_USE_BACKEND_FOR_SUPABASE === 'true'

export async function uploadUserPhoto(email: string, dataUrl: string): Promise<{ path: string; publicUrl?: string }> {
  if (USE_BACKEND) {
    const r = await fetch('/api/supabase/upload', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, dataUrl })
    })
    if (!r.ok) throw new Error(`upload failed: ${r.status}`)
    return await r.json()
  }
  try {
    const supabase = getSupabaseClient()
    const folder = `sessions/${email}`
    const base64 = dataUrl.split(',')[1]
    const bin = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
    const fileName = `photo_${Date.now()}.jpg`
    const path = `${folder}/${fileName}`
    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, bin, { contentType: 'image/jpeg', upsert: false })
    if (error) throw error
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
    try { console.log('[storage] photo saved', path) } catch {}
    return { path, publicUrl: data?.publicUrl }
  } catch (e) {
    try { console.warn('[uploadUserPhoto] client failed, fallback to backend', e) } catch {}
    const r = await fetch('/api/supabase/upload', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, dataUrl })
    })
    if (!r.ok) throw new Error(`upload failed (fallback): ${r.status}`)
    const j = await r.json()
    try { console.log('[storage] photo saved (backend)', j?.path) } catch {}
    return j
  }
}

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