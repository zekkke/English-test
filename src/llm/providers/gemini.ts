// Gemini Live Realtime (WebRTC): стрімінг мікрофона + прослуховування транскриптів через data channel
import type { LLMProvider, LLMProviderParams, ProviderEvent } from '../provider.ts'
import { QUESTIONS } from '../questions.ts'
import { EVAL_PROMPT } from '../prompts.ts'

export class GeminiProvider implements LLMProvider {
  private onEvent: (e: ProviderEvent) => void
  private idx = 0
  private readonly apiKey = (import.meta.env.VITE_GEMINI_API_KEY as string) || ''
  private readonly model = (import.meta.env.VITE_GEMINI_MODEL as string) || 'gemini-2.0-flash'
  private pc: RTCPeerConnection | null = null
  private dc: RTCDataChannel | null = null

  constructor(params: LLMProviderParams) {
    this.onEvent = params.onEvent
    this.bootstrap(params)
  }

  private async bootstrap(params: LLMProviderParams) {
    this.emit({ type: 'state', state: 'greeting' })
    const hello = "Welcome to the automated assessment system. You are about to take a short English test. Good luck. Are you ready?"
    this.emit({ type: 'assistant_said', text: hello })
    await this.speak(hello)
    await this.connectWebRTC(params)
    this.askNext()
  }

  private async connectWebRTC(params: LLMProviderParams) {
    if (!this.apiKey) return
    const pc = new RTCPeerConnection()
    this.pc = pc
    // локальний мікрофон
    const stream = params.getUserMediaStream()
    if (stream) {
      for (const track of stream.getAudioTracks()) pc.addTrack(track, stream)
    }
    // на всяк випадок
    try { pc.addTransceiver('audio', { direction: 'sendonly' }) } catch {}
    // data channel для подій/транскриптів
    this.dc = pc.createDataChannel('events')
    this.dc.onopen = () => console.log('[Gemini] data channel open')
    this.dc.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        // Очікуємо повідомлення вигляду {type:'transcript', text, final:true|false}
        if (msg.type === 'transcript' && typeof msg.text === 'string') {
          if (msg.final) {
            this.emit({ type: 'user_transcript', text: msg.text })
            // одразу запускаємо аналіз
            this.onUserAnswered(msg.text)
          }
        }
      } catch {}
    }

    pc.ontrack = () => {/* опціонально: відтворення TTS */}

    const offer = await pc.createOffer({ offerToReceiveAudio: false })
    await pc.setLocalDescription(offer)

    // дочекаємося збирання ICE, щоб мати повний SDP
    await new Promise<void>((resolve) => {
      if (!pc) return resolve()
      pc.onicecandidate = (e) => { if (!e.candidate) resolve() }
    })

    const sdp = pc.localDescription?.sdp || '';
    let res = await fetch('/api/gemini/start', { method:'POST', headers:{ 'Content-Type':'application/sdp' }, body:sdp });
    if (res.status === 404) {
      res = await fetch('/api/gemini/connect', { method:'POST', headers:{ 'Content-Type':'application/sdp' }, body:sdp });
    }
    if (!res.ok) {
      console.error('[Gemini] start/connect failed', res.status, await res.text());
      return;
    }
    const answerSdp = await res.text();
    await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
  }

  private askNext() {
    if (this.idx >= QUESTIONS.length) {
      this.emit({ type: 'state', state: 'finished' })
      return
    }
    const q = QUESTIONS[this.idx]
    this.emit({ type: 'state', state: 'asking' })
    this.emit({ type: 'assistant_said', text: q.text })
    this.emit({ type: 'progress', current: this.idx + 1, total: QUESTIONS.length })
    // Спочатку озвучка, потім listening
    this.speak(q.text).then(() => {
      this.emit({ type: 'state', state: 'listening' })
    })
    this.emit({ type: 'can_skip', value: true })
  }

  public async onUserAnswered(transcript: string) {
    this.emit({ type: 'state', state: 'analyzing' })
    const metrics = await this.evaluateTranscript(transcript)
    this.emit({ type: 'analysis_ready', payload: { questionId: String(this.idx), transcript, metrics } })
    this.idx += 1
    this.askNext()
  }

  private async evaluateTranscript(transcript: string): Promise<any> {
    const body = { contents: [{ role: 'user', parts: [{ text: `${EVAL_PROMPT}\n\nUSER:\n${transcript}` }] }] }
    try {
      // 1) Спробувати серверний роут (Vercel)
      let res = await fetch('/api/gemini/eval', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      // 2) Якщо немає серверного (локальний дев), fallback напряму (лише якщо є ключ у дев-середовищі)
      if (!res.ok && this.apiKey) {
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        })
      }
      const data = await res.json().catch(() => ({}))
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
      // Санітизуємо: вирізаємо перший JSON навіть якщо є ```json ... ```
      const start = typeof text === 'string' ? text.indexOf('{') : -1
      const end = typeof text === 'string' ? text.lastIndexOf('}') : -1
      const jsonSlice = start !== -1 && end !== -1 ? text.slice(start, end + 1) : text
      try { return JSON.parse(jsonSlice) } catch { return { feedback: String(text) } }
    } catch {
      return { fluency: 3, pronunciation: 3, grammar: 3, lexical: 3, coherence: 3, keyErrors: [], feedback: 'OK', rephrases: [] }
    }
  }

  repeat() {
    const q = QUESTIONS[this.idx]
    if (!q) return
    this.emit({ type: 'assistant_said', text: q.text })
    this.speak(q.text).then(() => {
      this.emit({ type: 'state', state: 'listening' })
    })
  }
  skip() { this.idx += 1; this.askNext() }
  dispose() { this.dc?.close(); this.pc?.close(); this.dc = null; this.pc = null }

  private emit(e: ProviderEvent) { this.onEvent(e) }
  private speak(text: string): Promise<void> {
    this.emit({ type: 'state', state: 'speaking' })
    return fetch('/api/eleven/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
      .then(async (r) => {
        if (!r.ok) return
        const blob = await r.blob()
        const url = URL.createObjectURL(blob)
        return new Promise<void>((resolve) => {
          const audio = new Audio(url)
          audio.onended = () => resolve()
          audio.onerror = () => resolve()
          audio.play().catch(() => resolve())
        })
      })
      .then(() => { /* done */ })
  }
}



