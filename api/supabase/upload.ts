export const config = { runtime: 'edge' }

import { createClient } from '@supabase/supabase-js'

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  try {
    const { email, dataUrl } = await req.json()
    if (!email || !dataUrl) return new Response('email and dataUrl are required', { status: 400 })

    const SUPABASE_URL = process.env.SUPABASE_URL || ''
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'English test'
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return new Response('Supabase env missing', { status: 500 })

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const base64 = String(dataUrl).split(',')[1] || ''
    const bin = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    const blob = new Blob([bin], { type: 'image/jpeg' })
    const path = `sessions/${email}/photo_${Date.now()}.jpg`
    const up = await supabase.storage.from(SUPABASE_BUCKET).upload(path, blob, { contentType: 'image/jpeg' })
    if (up.error) return new Response(up.error.message, { status: 500 })

    const pub = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(path)
    return new Response(JSON.stringify({ path, publicUrl: pub.data?.publicUrl }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    return new Response(String(e?.message || e), { status: 500 })
  }
}



