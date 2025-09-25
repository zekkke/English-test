import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRTC } from '../hooks/useRTC'
import { useLLMRealtime } from '../hooks/useLLMRealtime'
import { useScoring } from '../hooks/useScoring'
import { useI18n } from '../i18n/useI18n'
import { QUESTIONS } from '../llm/questions'
// AssemblyAI/Web Speech відключено — працюємо лише з Google STT
import { AvatarPanel } from './AvatarPanel'
import { Controls } from './Controls'
import { CameraPanel } from './CameraPanel'
import { useWebSpeechASR } from '../hooks/useWebSpeechASR'
import { ConsentModal } from './ConsentModal'

type Message = { role: 'assistant' | 'user' | 'analysis'; text: string; ts?: string }
type Analysis = { questionId: string; transcript: string; metrics: Record<string, any>; relevant?: boolean; reply?: string | null }

type Props = {
  userEmail?: string
  onFinished: (args: { analysis: Analysis[]; messages: Message[]; report: ReturnType<typeof useScoring> extends infer R ? R extends { finalize: (a: any) => infer T } ? T : any : any; timeExpired?: boolean }) => void
}

export default function SpeakingTest({ onFinished }: Props) {
  const TEST_DURATION_SECONDS = Number((import.meta as any).env.VITE_TEST_DURATION_SECONDS) || 15 * 60
  const [consented, setConsented] = useState(false)
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null)
  // Photo/Snapshot is not used in current flow
  const [timeExpired, setTimeExpired] = useState<boolean>(false)
  const isAndroid = useMemo(() => /Android/i.test(navigator.userAgent) && /Mobile/i.test(navigator.userAgent), [])

  const rtc = useRTC({ enabled: consented })
  const getStream = useCallback(() => rtc.stream, [rtc.stream])
  const llm = useLLMRealtime({ getUserMediaStream: getStream, onSpeechEnergy: rtc.onExternalEnergy, manualFinish: true })
  const [answerBuffer, setAnswerBuffer] = useState<string>('')
  const [webBuffer, setWebBuffer] = useState<string>('')

  // Вимкнено: aai/web asr

  // Google STT: запис фрагменту та синхронна відправка на бекенд
  function floatTo16BitPCM(buffer: Float32Array): Int16Array {
    const out = new Int16Array(buffer.length)
    for (let i = 0; i < buffer.length; i++) {
      const s = Math.max(-1, Math.min(1, buffer[i]))
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }
    return out
  }

  function downsampleBuffer(buffer: Float32Array, sourceRate: number, targetRate: number): Int16Array {
    if (targetRate === sourceRate) return floatTo16BitPCM(buffer)
    const ratio = sourceRate / targetRate
    const newLength = Math.round(buffer.length / ratio)
    const result = new Float32Array(newLength)
    let offsetResult = 0
    let offsetBuffer = 0
    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio)
      let acc = 0
      let count = 0
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) { acc += buffer[i]; count++ }
      result[offsetResult] = acc / count
      offsetResult++
      offsetBuffer = nextOffsetBuffer
    }
    return floatTo16BitPCM(result)
  }

  const recordPcmAndSendToGoogle = useCallback(async () => {
    let localStream: MediaStream | null = null
    try {
      let stream = getStream()
      if (!stream) { localStream = await navigator.mediaDevices.getUserMedia({ audio: true }); stream = localStream }
      if (!stream) throw new Error('No media stream')
      console.log('[GoogleSTT][PCM] stream ok, track:', (stream.getAudioTracks()[0] || {}).label)
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const src = ctx.createMediaStreamSource(stream)
      const proc = ctx.createScriptProcessor(4096, 1, 1)
      const chunks: Float32Array[] = []
      proc.onaudioprocess = (e) => { chunks.push(new Float32Array(e.inputBuffer.getChannelData(0))) }
      src.connect(proc); proc.connect(ctx.destination)
      // як було спочатку — простий фіксований сегмент ~3s
      await new Promise((r) => setTimeout(r, 3000))
      try { proc.disconnect(); src.disconnect(); ctx.close() } catch {}
      const total = chunks.reduce((a, c) => a + c.length, 0)
      const merged = new Float32Array(total); let off = 0; for (const c of chunks) { merged.set(c, off); off += c.length }
      const int16 = downsampleBuffer(merged, ctx.sampleRate || 44100, 16000)
      const b64 = btoa(String.fromCharCode(...new Uint8Array(int16.buffer)))
      const req = { config: { encoding: 'LINEAR16', sampleRateHertz: 16000, languageCode: 'en-US', enableAutomaticPunctuation: true }, audio: { content: b64 } }
      console.log('[GoogleSTT][PCM] request bytes ~', JSON.stringify(req).length)
      const r = await fetch('/api/google/stt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req) })
      console.log('[GoogleSTT][PCM] response status', r.status)
      const j: any = await r.json().catch(() => ({}))
      console.log('[GoogleSTT][PCM] response json', j)
      const text = j?.results?.[0]?.alternatives?.[0]?.transcript || ''
      if (text) setAnswerBuffer((prev) => (prev ? `${prev} ${text}` : text))
    } catch (e) {
      console.error('[GoogleSTT][PCM] error', e)
    } finally {
      try { localStream?.getTracks().forEach(t => t.stop()) } catch {}
    }
  }, [getStream])
  // Removed old MediaRecorder-based path; using PCM path above
  const scoring = useScoring()
  const { t } = useI18n()

  // Web Speech ASR (паралельно до Google STT)
  const webAsr = useWebSpeechASR({
    lang: 'en-US',
    onFinal: (text) => setWebBuffer((prev) => (prev ? `${prev} ${text}` : text)),
    onError: (err) => { try { console.warn('[WS] error', err) } catch {} },
    autoRestart: true,
    continuous: true,
    forceFinalOnEnd: true,
  })

  // Нормалізація двох транскриптів через Gemini
  const normalizeTranscripts = useCallback(async (g: string, w: string): Promise<string> => {
    try {
      const prompt = `You will receive two transcripts (GOOGLE and WEB) of the same short spoken answer. Merge them into ONE clean sentence/paragraph: remove duplicates and stutters, fix truncated words, keep user's meaning. Return STRICT JSON only: {"normalized": "..."}.\nGOOGLE:\n${g}\nWEB:\n${w}`
      const body = {
        contents: [
          { role: 'user', parts: [{ text: prompt }] },
        ],
      }
      const r = await fetch('/api/gemini/eval', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j: any = await r.json().catch(() => ({}))
      const txt: string = j?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
      const s = txt.indexOf('{'); const e = txt.lastIndexOf('}')
      const slice = s !== -1 && e !== -1 ? txt.slice(s, e + 1) : txt
      try { const obj = JSON.parse(slice); return String(obj?.normalized || '').trim() } catch {
        return (g || w || '').trim()
      }
    } catch {
      return (g || w || '').trim()
    }
  }, [])

  const unlockAudio = useCallback(async () => {
    try {
      const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext
      if (!AC) return
      const ctx = new AC()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      gain.gain.value = 0
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.01)
      setTimeout(() => { try { ctx.close() } catch {} }, 120)
    } catch {}
  }, [])

  const stopCurrentAsr = () => {
    try { webAsr.stop() } catch {}
  }
  useEffect(() => {
    if (llm.state === 'speaking' || llm.state === 'asking') {
      stopCurrentAsr()
    }
  }, [llm.state])

  const remainingSeconds = useMemo(() => {
    if (!sessionStartedAt) return TEST_DURATION_SECONDS
    const elapsed = Math.floor((Date.now() - sessionStartedAt) / 1000)
    return Math.max(0, TEST_DURATION_SECONDS - elapsed)
  }, [sessionStartedAt, llm.tick, TEST_DURATION_SECONDS])

  useEffect(() => {
    if (!sessionStartedAt) return
    if (remainingSeconds <= 0 && llm.state !== 'finished') {
      stopCurrentAsr()
      const text = (answerBuffer || '').trim()
      if (text) { llm.submitTranscript(text); setAnswerBuffer('') }
      setTimeExpired(true)
      setTimeout(() => {
        stopCurrentAsr()
        try { rtc.stop() } catch {}
        const report = scoring.finalize(llm.analysis as any)
        onFinished({ analysis: llm.analysis as any, messages: llm.messages as any, report, timeExpired: true })
      }, 400)
    }
  }, [remainingSeconds, sessionStartedAt, llm.state, answerBuffer, rtc, onFinished, scoring])

  useEffect(() => {
    if (llm.state === 'finished') {
      stopCurrentAsr()
      try { rtc.stop() } catch {}
      const report = scoring.finalize(llm.analysis as any)
      onFinished({ analysis: llm.analysis as any, messages: llm.messages as any, report, timeExpired })
    }
  }, [llm.state, timeExpired, rtc, onFinished, scoring])

  useEffect(() => {
    let timer: number | null = null
    if (llm.state === 'listening') {
      if (!isAndroid) {
        const run = async () => {
          if (llm.state !== 'listening') return
          await recordPcmAndSendToGoogle()
          if (llm.state === 'listening') timer = window.setTimeout(run, 500)
        }
        timer = window.setTimeout(run, 500)
        try { webAsr.start() } catch {}
      }
    } else { stopCurrentAsr(); setAnswerBuffer('') }
    return () => { if (timer) window.clearTimeout(timer) }
  }, [llm.state, isAndroid, recordPcmAndSendToGoogle])

  const handleFinishAnswer = useCallback(() => {
    try { console.log('[UI] handleFinishAnswer invoked, state=', llm.state, 'buffer=', answerBuffer) } catch {}
    stopCurrentAsr()
    try {
      const g = (answerBuffer || '').trim()
      const w = (webBuffer || '').trim()
      if (g || w) {
        try { console.log('[UI] normalizing transcripts', { gLen: g.length, wLen: w.length }) } catch {}
        normalizeTranscripts(g, w).then((norm) => {
          const finalText = (norm || g || w || '').trim()
          try { console.log('[UI] normalized=', finalText) } catch {}
          if (finalText) llm.submitTranscript(finalText)
        })
      } else {
        try { console.log('[UI] empty buffer -> submitting empty') } catch {}
        if (llm.state === 'listening') {
          try { llm.submitTranscript('') } catch (e) { try { console.error('[UI] submit empty error', e) } catch {} }
        } else {
          try { llm.skip() } catch (e) { try { console.error('[UI] skip error', e) } catch {} }
        }
      }
    } finally {
      setAnswerBuffer('')
      setWebBuffer('')
    }
  }, [answerBuffer, webBuffer, llm, normalizeTranscripts])

  const elapsedSeconds = useMemo(() => { if (!sessionStartedAt) return 0; return Math.floor((Date.now() - sessionStartedAt) / 1000) }, [sessionStartedAt, llm.tick])

  const total = QUESTIONS.length
  const current = Math.min(total, llm.analysis.length + (llm.state !== 'finished' ? 1 : 0))
  const progress = Math.round((current / total) * 100)

  const formatTime = (s: number) => { const mm = Math.floor(s / 60).toString().padStart(2, '0'); const ss = (s % 60).toString().padStart(2, '0'); return `${mm}:${ss}` }

  const handleStartClick = async () => { await unlockAudio(); setConsented(true); if (!sessionStartedAt) setSessionStartedAt(Date.now()); llm.start() }

  return (
    <div className="min-h-screen flex flex-col">
      <ConsentModal open={!consented} onAccept={() => setConsented(true)} t={t} mode={'speaking'} />
      <header className="px-4 pt-6 pb-3 sticky top-0 z-10">
        <div className="max-w-[80rem] mx-auto">
          <div className="w-full rounded-2xl bg-[#0f1115] text-white shadow-lg px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="text-base font-semibold">Simply AI Interviewer — Speaking</div>
              <div className="text-xs text-white/60">{t('ui.progress')}: {current}/{total}</div>
              <div className="h-2 w-28 bg-white/10 rounded"><div className="h-2 bg-brand-600 rounded" style={{ width: `${progress}%` }} /></div>
            </div>
            <div />
          </div>
        </div>
      </header>

      <div className="py-3">
        <div className="max-w-[80rem] mx-auto flex flex-col items-center gap-2">
          <div className={`text-3xl font-mono ${remainingSeconds <= 10 ? 'text-red-400' : 'text-white/90'}`}>{t('ui.time')}: {formatTime(remainingSeconds)}</div>
          {llm.state === 'idle' && (
            <button className="h-10 px-6 rounded-full bg-gradient-to-r from-brand-600 to-brand-700 text-sm font-medium shadow hover:opacity-95" onClick={handleStartClick}>{t('header.start')}</button>
          )}
        </div>
      </div>

      <div className="flex-1 max-w-[80rem] mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
        <div className="rounded-2xl bg-[linear-gradient(to_bottom_right,_#6F6F6F,_#313131)] shadow-lg p-4 min-h-[26rem] flex items-center justify-center">
          <CameraPanel
            stream={rtc.stream}
            isRecording={llm.state === 'listening' || llm.state === 'speaking'}
            micLevel={rtc.micLevel}
            onSnapshot={() => {}}
            elapsedSeconds={elapsedSeconds}
            autoSnapshotMs={Number((import.meta as any).env.VITE_AUTO_SNAPSHOT_MS) || 30000}
            onAutoSnapshot={() => {}}
          />
        </div>
        <div className="rounded-2xl bg-[linear-gradient(to_bottom_right,_#6F6F6F,_#313131)] shadow-lg p-5 flex flex-col">
          <div className="mb-4">
            <div className="text-2xl font-semibold text-white">{llm.messages.filter(m => m.role === 'assistant').slice(-1)[0]?.text || '—'}</div>
          </div>
          <div className="mb-4"><AvatarPanel state={llm.state} speechEnergy={llm.speechEnergy} t={t} questionText={undefined} onRepeat={llm.repeat} onSkip={llm.skip} /></div>
          <div className="mb-3">
            <div className="text-sm text-white/70 mb-2">Dialog</div>
            <div className="max-h-132 overflow-auto pr-1 bg-white/5 rounded-lg p-2">
              {llm.messages.map((m, i) => (
                <div key={i} className="text-sm text-white/90"><span style={{ fontWeight: 500 }}>{m.role === 'assistant' ? 'AI' : m.role === 'user' ? 'You' : '•'}</span>: {m.text}</div>
              ))}
            </div>
          </div>
          <div className="mt-auto pt-2">
            <Controls onRepeat={llm.repeat} onFinishAnswer={handleFinishAnswer} isAndroid={isAndroid} />
            {llm.state === 'listening' && (<div className="mt-2 text-xs text-white/70">ASR: Google STT is active…</div>)}
          </div>
        </div>
      </div>
    </div>
  )
}


