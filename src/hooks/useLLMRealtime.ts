import { useCallback, useEffect, useRef, useState } from 'react'
import type { LLMProvider } from '../llm/provider'
import { createLLMProvider } from '../llm/provider'

type Message = { role: 'assistant' | 'user' | 'analysis'; text: string; ts?: string }
type Analysis = {
  questionId: string
  transcript: string
  metrics: Record<string, any>
}

type Params = {
  getUserMediaStream: () => MediaStream | null
  onSpeechEnergy: (energy: number) => void
  startOnMount?: boolean
}

export function useLLMRealtime({ getUserMediaStream, onSpeechEnergy, startOnMount = false }: Params) {
  const providerRef = useRef<LLMProvider | null>(null)
  const [state, setState] = useState<'idle' | 'greeting' | 'asking' | 'listening' | 'speaking' | 'analyzing' | 'finished'>('idle')
  const [messages, setMessages] = useState<Message[]>([])
  const [analysis, setAnalysis] = useState<Analysis[]>([])
  const [speechEnergy, setSpeechEnergy] = useState(0)
  const [canSkip, setCanSkip] = useState(false)
  const [tick, setTick] = useState(0)
  const silenceSinceRef = useRef<number | null>(null)
  const startedRef = useRef(false)
  const [shouldStart, setShouldStart] = useState<boolean>(false)

  useEffect(() => {
    const wantsStart = startOnMount || shouldStart
    if (!wantsStart || startedRef.current) return
    startedRef.current = true
    ;(async () => {
      providerRef.current = await createLLMProvider({
        onEvent: (ev) => {
          if (ev.type === 'state') setState(ev.state)
          if (ev.type === 'assistant_said') setMessages((m) => [...m, { role: 'assistant', text: ev.text, ts: new Date().toLocaleTimeString() }])
          if (ev.type === 'user_transcript') setMessages((m) => [...m, { role: 'user', text: ev.text, ts: new Date().toLocaleTimeString() }])
          if (ev.type === 'analysis_ready') {
            const payload: any = ev.payload
            // Якщо відповідь не по темі — провайдер уже надіслав assistant_said і озвучив репліку (щоб не дублювати)
            if (payload?.relevant === false) {
              setAnalysis((a) => [...a, { ...payload, metrics: {} }])
            } else {
              // Зберігаємо аналіз для підрахунку, в UI показуємо короткий маркер
              setAnalysis((a) => [...a, payload])
              setMessages((m) => [...m, { role: 'analysis', text: 'analyzed', ts: new Date().toLocaleTimeString() }])
            }
            try { console.debug('[analysis]', payload) } catch {}
          }
          if (ev.type === 'energy') {
            setSpeechEnergy(ev.value)
            onSpeechEnergy(ev.value)
            silenceSinceRef.current = ev.value < 0.05 ? (silenceSinceRef.current ?? Date.now()) : null
          }
          if (ev.type === 'can_skip') setCanSkip(ev.value)
        },
        getUserMediaStream,
      })
    })()

    return () => { providerRef.current?.dispose() }
  }, [getUserMediaStream, onSpeechEnergy, startOnMount, shouldStart])

  const repeat = useCallback(() => {
    providerRef.current?.repeat()
  }, [])

  const skip = useCallback(() => {
    providerRef.current?.skip()
  }, [])

  useEffect(() => {
    const interval = setInterval(() => setTick((x) => (x + 1) % 1_000_000), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (state !== 'listening') return
    const id = setInterval(() => {
      if (silenceSinceRef.current && Date.now() - silenceSinceRef.current >= 5000) {
        providerRef.current?.skip()
        silenceSinceRef.current = null
      }
    }, 500)
    return () => clearInterval(id)
  }, [state])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (key === 'r') providerRef.current?.repeat()
      if (key === 'n') providerRef.current?.skip()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const submitTranscript = (text: string) => {
    const t = text.trim()
    if (!t) return
    setMessages((m) => [...m, { role: 'user', text: t, ts: new Date().toLocaleTimeString() }])
    providerRef.current?.onUserAnswered?.(t)
  }

  const start = () => setShouldStart(true)

  return { state, messages, analysis, repeat, skip, canSkip, speechEnergy, tick, submitTranscript, start }
}