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

  const geminiProxy = () => ({
    name: 'gemini-proxy',
    configureServer(server: ViteDevServer) {
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
