// Локальний оркестратор: ElevenLabs TTS + Web Speech ASR + локальний аналіз/оцінка via Gemini (через верхній рівень)
import type { LLMProvider, LLMProviderParams, ProviderEvent } from '../provider'
import { QUESTIONS } from '../questions'
import { EVAL_RELEVANCE_PROMPT } from '../prompts'

export class OpenAIProvider implements LLMProvider {
  private onEvent: (e: ProviderEvent) => void
  private idx = 0
  private awaitingUser = false
  private awaitingGreeting = false
  private lastAssistantText = ''
  private currentAudio: HTMLAudioElement | null = null
  private currentAudioUrl: string | null = null

  constructor(params: LLMProviderParams) {
    this.onEvent = params.onEvent
    this.bootstrap()
  }

  private static readonly NEXT_QUESTION_DELAY_MS: number = Number(((import.meta as any).env.VITE_NEXT_QUESTION_DELAY_MS ?? 1200))

  private async bootstrap() {
    this.emit({ type: 'state', state: 'greeting' })
    const hello = 'Welcome to the automated assessment system. You are about to take a short English test. Are you ready?'
    this.emit({ type: 'assistant_said', text: hello })
    this.lastAssistantText = hello
    await this.speak(hello)
    this.awaitingGreeting = true
    this.awaitingUser = true
    this.emit({ type: 'state', state: 'listening' })
  }

  private askNext() {
    if (this.idx >= QUESTIONS.length) { this.emit({ type: 'state', state: 'finished' }); return }
    const q = QUESTIONS[this.idx]
    this.emit({ type: 'state', state: 'asking' })
    this.emit({ type: 'assistant_said', text: q.text })
    this.lastAssistantText = q.text
    // Озвучити питання через ElevenLabs TTS та лише після завершення перейти в listening
    this.speak(q.text).then(() => {
      this.awaitingUser = true
      this.emit({ type: 'state', state: 'listening' })
    })
    this.emit({ type: 'can_skip', value: true })
  }

  public async onUserAnswered(transcript: string) {
    if (!this.awaitingUser) return
    // Ігноруємо очевидні ехо: коли ASR повторює щойно озвучене питання
    const normalized = transcript.trim().toLowerCase()
    const lastQ = this.lastAssistantText.trim().toLowerCase()
    if (normalized && lastQ && (normalized === lastQ || (normalized.length <= lastQ.length + 3 && lastQ.includes(normalized)))) {
      return
    }
    this.emit({ type: 'state', state: 'analyzing' })
    const evalResult = await this.evaluateWithGemini(transcript)
    if (this.awaitingGreeting) {
      // Оцінюємо привітання, не збільшуючи індекс питання
      this.awaitingGreeting = false
      this.emit({ type: 'analysis_ready', payload: { questionId: 'greeting', transcript, metrics: evalResult?.metrics ?? {}, relevant: evalResult?.relevant, reply: evalResult?.reply } })
      this.awaitingUser = false
      setTimeout(() => this.askNext(), OpenAIProvider.NEXT_QUESTION_DELAY_MS)
      return
    }
    // Якщо відповідь не по темі — не переходимо до наступного питання
    if (evalResult?.relevant === false) {
      const reply = evalResult?.reply || "This question is not related to the topic of testing. Let's move on to the next question."
      // Показати відповідь AI у чаті і озвучити її
      this.emit({ type: 'assistant_said', text: reply })
      this.emit({ type: 'analysis_ready', payload: { questionId: String(this.idx), transcript, metrics: {}, relevant: false, reply } })
      await this.speak(reply)
      // Залишаємося на тому ж питанні, чекаємо релевантної відповіді
      this.awaitingUser = true
      this.emit({ type: 'state', state: 'listening' })
      this.emit({ type: 'can_skip', value: true })
      return
    }
    // Релевантна відповідь → оцінка і перехід далі
    this.emit({ type: 'analysis_ready', payload: { questionId: String(this.idx), transcript, metrics: evalResult?.metrics ?? {}, relevant: true } })
    this.idx += 1
    this.awaitingUser = false
    setTimeout(() => this.askNext(), OpenAIProvider.NEXT_QUESTION_DELAY_MS)
  }

  repeat() { const q = QUESTIONS[this.idx]; if (q) { this.emit({ type: 'assistant_said', text: q.text }); this.lastAssistantText = q.text; this.speak(q.text).then(() => { this.awaitingUser = true; this.emit({ type: 'state', state: 'listening' }) }) } }
  skip() { this.awaitingUser = false; this.stopSpeaking(); this.idx += 1; setTimeout(() => this.askNext(), OpenAIProvider.NEXT_QUESTION_DELAY_MS) }
  dispose() { /* no-op */ }

  private emit(e: ProviderEvent) { this.onEvent(e) }
  private speak(text: string): Promise<void> {
    this.emit({ type: 'state', state: 'speaking' })
    // У продакшні використовуємо серверний роут (Vercel) /api/eleven/tts
    // У деві цей шлях також працюватиме, якщо є dev proxy; інакше можна підняти локальний сервер
    return fetch('/api/eleven/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
      .then(async (r) => {
        if (!r.ok) return
        const blob = await r.blob()
        const url = URL.createObjectURL(blob)
        return new Promise<void>((resolve) => {
          this.stopSpeaking()
          const audio = new Audio(url)
          this.currentAudio = audio
          this.currentAudioUrl = url
          audio.onended = () => { this.cleanupAudio(); resolve() }
          audio.onerror = () => { this.cleanupAudio(); resolve() }
          audio.play().catch(() => { this.cleanupAudio(); resolve() })
        })
      })
      .then(() => { /* finished speaking */ })
  }

  private cleanupAudio() {
    if (this.currentAudio) {
      try { this.currentAudio.pause() } catch {}
      this.currentAudio = null
    }
    if (this.currentAudioUrl) {
      try { URL.revokeObjectURL(this.currentAudioUrl) } catch {}
      this.currentAudioUrl = null
    }
  }

  private stopSpeaking() {
    this.cleanupAudio()
  }

  private async evaluateWithGemini(transcript: string): Promise<any> {
    try {
      const question = this.lastAssistantText
      const body = { contents: [
        { role: 'user', parts: [{ text: EVAL_RELEVANCE_PROMPT }] },
        { role: 'user', parts: [{ text: `QUESTION:\n${question}\n\nUSER:\n${transcript}` }] },
      ] }
      // Retries for transient errors (429/5xx)
      const maxRetries = 3
      let j: any = null
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const r = await fetch('/api/gemini/eval', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        if (r.ok) { j = await r.json(); break }
        if (![429, 500, 502, 503, 504].includes(r.status)) {
          try { j = await r.json() } catch { j = null }
          break
        }
        const backoffMs = 300 * Math.pow(2, attempt) + Math.floor(Math.random() * 200)
        await new Promise(res => setTimeout(res, backoffMs))
      }
      if (!j) {
        // graceful fallback: відмітимо як тимчасово недоступний аналіз
        return { relevant: true, metrics: {}, reply: null, note: 'analysis_unavailable' }
      }
      const text: string = j?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
      // Санітизуємо відповідь: знаходимо перший та останній символи JSON
      const start = text.indexOf('{')
      const end = text.lastIndexOf('}')
      const jsonSlice = start !== -1 && end !== -1 ? text.slice(start, end + 1) : text
      try {
        const parsed = JSON.parse(jsonSlice)
        return parsed
      } catch { return { feedback: jsonSlice } }
    } catch (e) {
      return { feedback: String(e) }
    }
  }
}