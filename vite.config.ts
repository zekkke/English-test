import { defineConfig, loadEnv, type ViteDevServer } from 'vite'
import type { IncomingMessage, ServerResponse } from 'http'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const GEMINI_MODEL = env.VITE_GEMINI_MODEL || 'gemini-2.0-flash'
  const GEMINI_KEY = env.VITE_GEMINI_API_KEY || ''
  const OAI_MODEL = env.VITE_OPENAI_REALTIME_MODEL || 'gpt-4o-realtime-preview'
  const OAI_KEY = env.VITE_OPENAI_API_KEY || ''
  const ELEVEN_KEY = env.VITE_ELEVEN_API_KEY || ''
  const ELEVEN_VOICE = env.VITE_ELEVEN_VOICE || '21m00Tcm4TlvDq8ikWAM'
  const SUPABASE_URL = env.SUPABASE_URL || ''
  const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || ''
  const SUPABASE_BUCKET = env.SUPABASE_BUCKET || 'English test'
  const RESEND_KEY = env.RESEND_API_KEY || ''
  const RESEND_FROM = env.RESEND_FROM || 'no-reply@example.com'

  const geminiProxy = () => ({
    name: 'gemini-proxy',
    configureServer(server: ViteDevServer) {
      // Lazy import to avoid bundling in client
      const ensureSupabase = async () => {
        const mod = await import('@supabase/supabase-js')
        return mod.createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      }

      const parseJson = (req: IncomingMessage) => new Promise<any>((resolve) => {
        let body = ''
        req.setEncoding('utf8')
        req.on('data', (chunk: string) => (body += chunk))
        req.on('end', () => {
          try { resolve(JSON.parse(body || '{}')) } catch { resolve({}) }
        })
      })

      const send = async (req: IncomingMessage, res: ServerResponse, url: string) => {
        let body = ''
        req.setEncoding('utf8')
        req.on('data', (chunk: string) => (body += chunk))
        req.on('end', async () => {
          try {
            const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/sdp' }, body })
            const text = await r.text()
            res.statusCode = r.status
            res.setHeader('Content-Type', 'application/sdp')
            res.end(text)
          } catch (e) {
            res.statusCode = 500
            res.end(String(e))
          }
        })
      }

      server.middlewares.use('/api/gemini/start', (req, res) =>
        send(
          req,
          res,
          `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:start?alt=sdp&key=${GEMINI_KEY}`,
        ),
      )

      server.middlewares.use('/api/gemini/connect', (req, res) =>
        send(
          req,
          res,
          `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:realtime:connect?alt=sdp&key=${GEMINI_KEY}`,
        ),
      )

      // OpenAI Realtime proxy
      server.middlewares.use('/api/openai/realtime', (req, res) => {
        const url = `https://api.openai.com/v1/realtime?model=${OAI_MODEL}`
        let body = ''
        req.setEncoding('utf8')
        req.on('data', (chunk: string) => (body += chunk))
        req.on('end', async () => {
          try {
            const r = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/sdp',
                'Authorization': `Bearer ${OAI_KEY}`,
                'OpenAI-Beta': 'realtime=v1',
              },
              body,
            })
            const text = await r.text()
            res.statusCode = r.status
            res.setHeader('Content-Type', 'application/sdp')
            res.end(text)
          } catch (e) {
            res.statusCode = 500
            res.end(String(e))
          }
        })
      })

      // Gemini text eval (REST generateContent)
      server.middlewares.use('/api/gemini/eval', (req, res) => {
        let body = ''
        req.setEncoding('utf8')
        req.on('data', (chunk: string) => (body += chunk))
        req.on('end', async () => {
          try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`
            const r = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body,
            })
            const text = await r.text()
            res.statusCode = r.status
            res.setHeader('Content-Type', 'application/json')
            res.end(text)
          } catch (e) {
            res.statusCode = 500
            res.end(String(e))
          }
        })
      })

      // ElevenLabs TTS stream
      server.middlewares.use('/api/eleven/tts', (req, res) => {
        let json = ''
        req.setEncoding('utf8')
        req.on('data', (chunk: string) => (json += chunk))
        req.on('end', async () => {
          try {
            const { text } = JSON.parse(json || '{}') as { text?: string }
            const url = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE}/stream?optimize_streaming_latency=3`
            const r = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'accept': 'audio/mpeg',
                'xi-api-key': ELEVEN_KEY,
              },
              body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }),
            })
            const ab = await r.arrayBuffer()
            res.statusCode = r.status
            res.setHeader('Content-Type', 'audio/mpeg')
            res.end(Buffer.from(ab))
          } catch (e) {
            res.statusCode = 500
            res.end(String(e))
          }
        })
      })

      // Supabase: upload photo (dev only)
      server.middlewares.use('/api/supabase/upload', async (req, res) => {
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
          res.statusCode = 500
          res.end('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing')
          return
        }
        const { email, dataUrl } = await parseJson(req)
        if (!email || !dataUrl) {
          res.statusCode = 400
          res.end('email and dataUrl are required')
          return
        }
        try {
          const supabase = await ensureSupabase()
          const base64 = String(dataUrl).split(',')[1] || ''
          const bin = Uint8Array.from(Buffer.from(base64, 'base64'))
          const fileName = `photo_${Date.now()}.jpg`
          const path = `sessions/${email}/${fileName}`
          const up = await supabase.storage.from(SUPABASE_BUCKET).upload(path, bin, { contentType: 'image/jpeg' })
          if (up.error) throw up.error
          const pub = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(path)
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ path, publicUrl: pub.data?.publicUrl }))
        } catch (e: any) {
          res.statusCode = 500
          res.end(String(e))
        }
      })

      // Supabase: insert interview_metrics (dev only)
      server.middlewares.use('/api/supabase/metrics', async (req, res) => {
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
          res.statusCode = 500
          res.end('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing')
          return
        }
        const body = await parseJson(req)
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
        if (!candidate_id || !session_id) {
          res.statusCode = 400
          res.end('candidate_id and session_id are required')
          return
        }
        try {
          const supabase = await ensureSupabase()
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
          if (ins.error) throw ins.error
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true }))
        } catch (e: any) {
          res.statusCode = 500
          res.end(String(e))
        }
      })

      // Email: send access code via Resend (dev only)
      server.middlewares.use('/api/email/send-code', async (req, res) => {
        if (!RESEND_KEY) { res.statusCode = 500; res.end('RESEND_API_KEY missing'); return }
        const payload = await parseJson(req)
        const to = String(payload?.to || '').trim()
        const code = String(payload?.code || '').trim()
        if (!to || !code) { res.statusCode = 400; res.end('to and code are required'); return }
        try {
          const { Resend } = await import('resend')
          const resend = new Resend(RESEND_KEY)
          const subject = 'Ваш код доступу до AI English Interviewer'
          const html = `
            <div style="font-family:Inter,Segoe UI,Arial,sans-serif;line-height:1.6;color:#0f172a">
              <h2 style="margin:0 0 12px">Підтвердження входу</h2>
              <p>Ваш одноразовий код доступу:</p>
              <p style="font-size:24px;font-weight:700;letter-spacing:3px;margin:8px 0 16px">${code}</p>
              <p>Код дійсний протягом 10 хвилин. Якщо ви не ініціювали вхід — проігноруйте цей лист.</p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0" />
              <p style="font-size:12px;color:#64748b">AI English Interviewer</p>
            </div>`
          const resp = await resend.emails.send({ from: RESEND_FROM, to, subject, html })
          if ((resp as any)?.error) { throw (resp as any).error }
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true }))
        } catch (e: any) {
          res.statusCode = 500
          res.end(String(e))
        }
      })
    },
  })

  return {
    plugins: [react(), tailwindcss(), geminiProxy()],
    server: {
      port: 5173,
      strictPort: true,
      host: 'localhost',
      proxy: {},
    },
  }
})
