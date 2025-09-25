import { useCallback, useEffect, useRef, useState } from 'react'
import { WRITING_QUESTIONS } from '../llm/writingQuestions'
import { useI18n } from '../i18n/useI18n'
import { ConsentModal } from './ConsentModal'
import { useScoring } from '../hooks/useScoring'
import { AvatarPanel } from './AvatarPanel'

type Message = { role: 'assistant' | 'user' | 'analysis'; text: string; ts?: string }
type Analysis = { questionId: string; transcript: string; metrics: Record<string, any>; relevant?: boolean; reply?: string | null }

type Props = {
  onFinished: (args: { analysis: Analysis[]; messages: Message[]; report: ReturnType<typeof useScoring> extends infer R ? R extends { finalize: (a: any) => infer T } ? T : any : any }) => void
  onProceedToSpeaking?: () => void
}

export default function WritingTest({ onFinished, onProceedToSpeaking }: Props) {
  const [state, setState] = useState<'idle' | 'greeting' | 'asking' | 'typing' | 'speaking' | 'analyzing' | 'finished'>('idle')
  const [idx, setIdx] = useState<number>(0)
  const [messages, setMessages] = useState<Message[]>([])
  const [analysis, setAnalysis] = useState<Analysis[]>([])
  const [buffer, setBuffer] = useState('')
  // proceed flag removed; flow controlled by local state transitions
  const [started, setStarted] = useState<boolean>(false)
  const [remainingSeconds, setRemainingSeconds] = useState<number>(15 * 60)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const scoring = useScoring()
  const { t } = useI18n()
  const [consented, setConsented] = useState<boolean>(false)

  // current question is read lazily from WRITING_QUESTIONS by index
  const total = WRITING_QUESTIONS.length
  const current = Math.min(total, analysis.length + (state !== 'finished' ? 1 : 0))
  const progress = Math.round((current / total) * 100)

  const formatTime = (s: number) => {
    const mm = Math.floor(s / 60).toString().padStart(2, '0')
    const ss = (s % 60).toString().padStart(2, '0')
    return `${mm}:${ss}`
  }

  const speak = useCallback(async (text: string) => {
    setState('speaking')
    try {
      const r = await fetch('/api/eleven/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
      if (!r.ok) return
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      await new Promise<void>((resolve) => {
        const audio = new Audio(url)
        audio.preload = 'auto'
        const cleanup = () => { try { URL.revokeObjectURL(url) } catch {} }
        audio.onended = () => { cleanup(); resolve() }
        audio.onerror = () => { cleanup(); resolve() }
        const start = async () => {
          // Невелика затримка + очікування готовності декодера
          await new Promise((r2) => setTimeout(r2, 250))
          try { await audio.play() } catch { /* ignore */ }
        }
        if (audio.readyState >= 3 /* HAVE_FUTURE_DATA */) { start() } else {
          audio.addEventListener('canplaythrough', () => start(), { once: true })
          // страховка на випадок, якщо подія не прийде
          setTimeout(() => start(), 400)
        }
      })
    } catch {}
  }, [])

  const askNext = useCallback(async (forcedIndex?: number) => {
    const useIdx = typeof forcedIndex === 'number' ? forcedIndex : idx
    if (useIdx >= WRITING_QUESTIONS.length) {
      setState('finished')
      const report = scoring.finalize(analysis as any)
      try { onFinished({ analysis, messages, report }) } catch {}
      // finished; proceed button available via parent callback
      return
    }
    setState('asking')
    const q = WRITING_QUESTIONS[useIdx]
    setMessages((m) => [...m, { role: 'assistant', text: q.text, ts: new Date().toLocaleTimeString() }])
    await speak(q.text)
    setState('typing')
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [idx, analysis, messages, scoring, onFinished, speak])

  useEffect(() => {
    if (!started) return
    if (state === 'idle') {
      ;(async () => {
        setState('greeting')
        const hello = 'Welcome to the writing section. Please answer each question in 80–160 words. Take your time.'
        setMessages((m) => [...m, { role: 'assistant', text: hello, ts: new Date().toLocaleTimeString() }])
        await speak(hello)
        setState('asking')
        askNext()
      })()
    }
  }, [started, state, askNext, speak])

  // 15-minute countdown after user starts the test
  useEffect(() => {
    if (!started) return
    if (state === 'finished') return
    if (remainingSeconds <= 0) {
      setState('finished')
      const report = scoring.finalize(analysis as any)
      try { onFinished({ analysis, messages, report }) } catch {}
      // finished; proceed button available via parent callback
      return
    }
    const t = window.setTimeout(() => setRemainingSeconds((x) => x - 1), 1000)
    return () => window.clearTimeout(t)
  }, [started, remainingSeconds, state, scoring, analysis, messages, onFinished])

  const startTest = useCallback(() => {
    setStarted(true)
    setRemainingSeconds(15 * 60)
    setState('idle')
  }, [])

  const evaluate = useCallback(async (questionText: string, transcript: string) => {
    try {
      const body = { contents: [
        { role: 'user', parts: [{ text: `You are an English interviewer. Given the QUESTION and the USER answer, first decide if the answer is relevant to the QUESTION. If relevant, also return CEFR-like metrics (0-5) for the answer. If not relevant (e.g., user asks another question or ignores the topic), provide a short helpful REPLY to guide the user back to the topic. Always return STRICT JSON only:{"relevant": true|false, "reply": string | null, "metrics": { "fluency": 0-5, "pronunciation": 0-5, "grammar": 0-5, "lexical": 0-5, "coherence": 0-5, "keyErrors": ["..."], "feedback": "...", "rephrases": ["...", "..."] }}` }] },
        { role: 'user', parts: [{ text: `QUESTION:\n${questionText}\n\nUSER:\n${transcript}` }] },
      ] }
      const r = await fetch('/api/gemini/eval', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j: any = await r.json().catch(() => ({}))
      const text: string = j?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
      const start = text.indexOf('{')
      const end = text.lastIndexOf('}')
      const jsonSlice = start !== -1 && end !== -1 ? text.slice(start, end + 1) : text
      try { return JSON.parse(jsonSlice) } catch { return { feedback: jsonSlice } }
    } catch (e) {
      return { feedback: String(e) }
    }
  }, [])

  const submit = useCallback(async () => {
    if (state !== 'typing') return
    const t = buffer.trim()
    const q = WRITING_QUESTIONS[idx]
    setBuffer('')

    // Якщо є текст — оцінюємо й переходимо далі
    if (t) {
      setMessages((m) => [...m, { role: 'user', text: t, ts: new Date().toLocaleTimeString() }])
      setState('analyzing')
      const evalResult = await evaluate(q.text, t)
      if (evalResult?.relevant === false) {
        const reply = evalResult?.reply || 'Answer was not on topic. Moving to the next question.'
        setMessages((m) => [...m, { role: 'assistant', text: reply, ts: new Date().toLocaleTimeString() }])
        setAnalysis((a) => [...a, { questionId: String(q.id), transcript: t, metrics: evalResult?.metrics ?? {}, relevant: false, reply }])
      } else {
        setAnalysis((a) => [...a, { questionId: String(q.id), transcript: t, metrics: evalResult?.metrics ?? {}, relevant: true }])
      }
      const nextIndex = idx + 1
      setIdx(nextIndex)
      setState('asking')
      setTimeout(() => { askNext(nextIndex) }, 50)
      return
    }

    // Порожня відповідь — фіксуємо нульові бали і переходимо далі
    const zeroMetrics = { fluency: 0, pronunciation: 0, grammar: 0, lexical: 0, coherence: 0, keyErrors: ['No answer'], feedback: 'No answer provided', rephrases: [] as string[] }
    setAnalysis((a) => [...a, { questionId: String(q.id), transcript: '', metrics: zeroMetrics, relevant: false, reply: 'No answer' }])
    const nextIndex = idx + 1
    setIdx(nextIndex)
    setState('asking')
    setTimeout(() => { askNext(nextIndex) }, 50)
  }, [buffer, state, idx, evaluate, askNext])

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || !e.shiftKey)) {
      e.preventDefault()
      submit()
    }
  }

  const handleRepeat = () => { const q = WRITING_QUESTIONS[idx]; if (q) speak(q.text) }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-4 pt-6 pb-3 sticky top-0 z-10">
        <div className="max-w-[80rem] mx-auto">
          <div className="w-full rounded-2xl bg-[#0f1115] text-white shadow-lg px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="text-base font-semibold">Simply AI Interviewer — Writing</div>
              <div className="text-xs text-white/60">Progress: {Math.min(idx + 1, total)}/{total}</div>
              <div className="h-2 w-28 bg-white/10 rounded">
                <div className="h-2 bg-brand-600 rounded" style={{ width: `${progress}%` }} />
              </div>
            </div>
            <div>
              <button
                className="h-9 px-4 rounded-full bg-gradient-to-r from-brand-600 to-brand-700 text-xs font-medium shadow hover:opacity-95"
                onClick={onProceedToSpeaking}
              >Перейти до мовного тесту</button>
            </div>
          </div>
        </div>
      </header>

      {/* Centered timer + Start button (like speaking) */}
      <div className="py-3">
        <div className="max-w-[80rem] mx-auto flex flex-col items-center gap-2">
          {started && (
            <div className={`text-3xl font-mono ${remainingSeconds <= 10 ? 'text-red-400' : 'text-white/90'}`}>{t('ui.time')}: {formatTime(remainingSeconds)}</div>
          )}
          {!started && consented && (
            <button
              className="h-10 px-6 rounded-full bg-gradient-to-r from-brand-600 to-brand-700 text-sm font-medium shadow hover:opacity-95"
              onClick={startTest}
            >{t('header.start')}</button>
          )}
        </div>
      </div>

      {!started ? (
        <div className="flex-1 max-w-[80rem] mx-auto w-full p-4 flex items-center justify-center">
          <ConsentModal open={!consented} onAccept={() => setConsented(true)} t={t} mode={'writing'} />
        </div>
      ) : (
      <div className="flex-1 max-w-[80rem] mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
        {/* Активне питання (заголовок) + аватар як у Speaking */}
        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-2xl bg-[linear-gradient(to_bottom_right,_#6F6F6F,_#313131)] shadow-lg p-5">
            <div className="text-2xl font-semibold text-white">
              {messages.filter(m => m.role === 'assistant').slice(-1)[0]?.text || '—'}
            </div>
          </div>
          <div className="rounded-2xl bg-[linear-gradient(to_bottom_right,_#6F6F6F,_#313131)] shadow-lg p-5">
            <AvatarPanel state={state === 'speaking' ? 'speaking' : (state === 'asking' ? 'asking' : (state === 'typing' ? 'listening' : (state as any)))} speechEnergy={0} t={t} />
          </div>
        </div>
        <div className="rounded-2xl bg-[linear-gradient(to_bottom_right,_#6F6F6F,_#313131)] shadow-lg p-5 flex flex-col">
          <div className="mb-3">
            <div className="text-sm text-white/70 mb-2">Dialog</div>
            <div className="max-h-132 overflow-auto pr-1 space-y-2">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[90%] rounded-xl px-3 py-2 text-sm shadow ${m.role === 'assistant' ? 'bg-white/10 text-white border border-white/10' : 'bg-brand-600 text-white'}`}>
                    <div className="text-[10px] uppercase tracking-wide opacity-70 mb-0.5">{m.role === 'assistant' ? 'AI' : m.role === 'user' ? 'You' : 'Info'}</div>
                    <div>{m.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-auto pt-2 flex items-center gap-2">
            <button className="h-10 px-6 rounded-full bg-white/20 text-sm" onClick={handleRepeat}>Repeat</button>
          </div>
        </div>

        <div className="rounded-2xl bg-[linear-gradient(to_bottom_right,_#6F6F6F,_#313131)] shadow-lg p-5 flex flex-col">
          <div className="mb-3">
            <div className="text-sm text-white/70 mb-1">Your answer</div>
            <textarea
              ref={inputRef}
              className="w-full min-h-[12rem] rounded-xl p-3 text-gray-900"
              placeholder="Type your answer here... Press Enter to submit."
              value={buffer}
              onChange={(e) => setBuffer(e.target.value)}
              onKeyDown={onKeyDown}
            />
          </div>
          <div className="mt-auto pt-2 flex items-center gap-2">
            <button className="h-10 px-6 rounded-full bg-gradient-to-r from-brand-600 to-brand-700 text-sm font-medium shadow disabled:opacity-40" disabled={state !== 'typing'} onClick={submit}>Finish answer</button>
          </div>
          <div className="mt-3 text-xs text-white/70">Press Enter to submit. Use Shift+Enter for new line.</div>
        </div>
      </div>
      )}

      {state === 'finished' && (
        <div className="p-4">
          <div className="max-w-[80rem] mx-auto">
            <div className="rounded-2xl bg-white/10 text-white p-4 flex items-center justify-between">
              <div>Writing section completed.</div>
              <button className="h-10 px-6 rounded-full bg-gradient-to-r from-brand-600 to-brand-700 text-sm font-medium shadow" onClick={onProceedToSpeaking}>Start Speech Testing</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


