import { useCallback, useEffect, useMemo, useState } from 'react'
import { Controls } from './components/Controls.tsx'
import { CameraPanel } from './components/CameraPanel.tsx'
import { AvatarPanel } from './components/AvatarPanel.tsx'
import { TranscriptList } from './components/TranscriptList.tsx'
import { ScoreCard } from './components/ScoreCard.tsx'
import { ConsentModal } from './components/ConsentModal.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { useRTC } from './hooks/useRTC.ts'
import { useLLMRealtime } from './hooks/useLLMRealtime.ts'
import { useScoring } from './hooks/useScoring.ts'
import { useI18n } from './i18n/useI18n.ts'
import { QUESTIONS } from './llm/questions.ts'
import { useWebSpeechASR } from './hooks/useWebSpeechASR.ts'
import Auth from './components/Auth.tsx'
import { uploadUserPhoto } from './services/supabaseService.ts'

function InterviewApp({ userEmail }: { userEmail: string }) {
  const [consented, setConsented] = useState(false)
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null)
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null)
  const [view, setView] = useState<'interview' | 'report'>('interview')
  const isAndroid = useMemo(() => /Android/i.test(navigator.userAgent) && /Mobile/i.test(navigator.userAgent), [])

  const rtc = useRTC({ enabled: consented })
  const getStream = useCallback(() => rtc.stream, [rtc.stream])
  const llm = useLLMRealtime({
    getUserMediaStream: getStream,
    onSpeechEnergy: rtc.onExternalEnergy,
  })
  const asr = useWebSpeechASR({
    lang: 'en-US',
    onFinal: (text) => llm.submitTranscript(text),
    onError: (err) => console.warn('ASR error', err),
    autoRestart: !isAndroid,
    continuous: !isAndroid,
    forceFinalOnEnd: true,
  })
  const scoring = useScoring()
  const { t } = useI18n()
  const safeReport = useMemo(() => {
    try {
      return scoring.finalize(llm.analysis)
    } catch (e) {
      try { console.error('finalize failed', e) } catch {}
      return { cefr: 'A1' as const, subscores: { fluency: 0, pronunciation: 0, grammar: 0, lexical: 0, coherence: 0 }, feedback: '—', keyErrors: [] as string[], rephrases: [] as string[] }
    }
  }, [llm.analysis])

  const handleAutoSnapshot = useCallback(async (dataUrl: string) => {
    try {
      const email = userEmail || ''
      if (!email) return
      if (llm.state === 'finished') return
      await uploadUserPhoto(email, dataUrl)
    } catch (e) { try { console.warn('Auto snapshot upload failed', e) } catch {} }
  }, [userEmail, llm.state])

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

  // iOS/Android мобільний guard: не стартувати ASR, поки відтворюється звук
  useEffect(() => {
    if (llm.state === 'speaking') {
      try { asr.stop() } catch {}
    }
  }, [llm.state])

  useEffect(() => {
    if (consented && !sessionStartedAt) setSessionStartedAt(Date.now())
  }, [consented, sessionStartedAt])

  useEffect(() => {
    if (llm.state === 'finished') {
      try { asr.stop() } catch {}
      try { rtc.stop() } catch {}
      setView('report')
    }
  }, [llm.state])

  // Вмикаємо/вимикаємо Web Speech залежно від стану
  useEffect(() => {
    let timer: number | null = null
    if (llm.state === 'listening') {
      if (!isAndroid) {
        timer = window.setTimeout(() => { try { asr.start() } catch {} }, 500)
      }
    } else {
      try { asr.stop() } catch {}
    }
    return () => { if (timer) window.clearTimeout(timer) }
  }, [llm.state, isAndroid])

  const elapsedSeconds = useMemo(() => {
    if (!sessionStartedAt) return 0
    return Math.floor((Date.now() - sessionStartedAt) / 1000)
  }, [sessionStartedAt, llm.tick])

  const total = QUESTIONS.length
  const current = Math.min(total, llm.analysis.length + (llm.state !== 'finished' ? 1 : 0))
  const progress = Math.round((current / total) * 100)

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header-pill */}
      <header className="px-4 pt-6 pb-3 sticky top-0 z-10">
        <div className="max-w-[80rem] mx-auto">
          <div className="w-full rounded-2xl bg-[#0f1115] text-white shadow-lg px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="text-base font-semibold">AI English Interviver</div>
              <div className="text-xs text-white/60">Готовність: {current}/{total}</div>
              <div className="h-2 w-28 bg-white/10 rounded">
                <div className="h-2 bg-brand-600 rounded" style={{ width: `${progress}%` }} />
              </div>
            </div>
            <div>
              {llm.state === 'idle' && (
                <button
                  className="h-9 px-4 rounded-full bg-gradient-to-r from-brand-600 to-brand-700 text-sm font-medium shadow hover:opacity-95"
                  onClick={async () => { await unlockAudio(); llm.start() }}
                >Почати</button>
              )}
            </div>
          </div>
        </div>
      </header>

      <ConsentModal open={!consented} onAccept={() => setConsented(true)} t={t} />

      {view === 'interview' && (
        <div className="flex-1 max-w-[80rem] mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
          {/* Left card: Camera */}
          <div className="rounded-2xl bg-[linear-gradient(to_bottom_right,_#6F6F6F,_#313131)] shadow-lg p-4 min-h-[26rem] flex items-center justify-center">
            <CameraPanel
              stream={rtc.stream}
              isRecording={llm.state === 'listening' || llm.state === 'speaking'}
              micLevel={rtc.micLevel}
              onSnapshot={(url) => setPhotoDataUrl(url)}
              elapsedSeconds={elapsedSeconds}
              autoSnapshotMs={Number((import.meta as any).env.VITE_AUTO_SNAPSHOT_MS) || 30000}
              onAutoSnapshot={handleAutoSnapshot}
            />
          </div>

          {/* Right card: Avatar + Question + Dialog */}
          <div className="rounded-2xl bg-[linear-gradient(to_bottom_right,_#6F6F6F,_#313131)] shadow-lg p-5 flex flex-col">
            <div className="mb-4">
              <div className="text-2xl font-semibold text-gray-800">
                {llm.messages.filter(m => m.role === 'assistant').slice(-1)[0]?.text || '—'}
              </div>
            </div>

            {/* Avatar status strip */}
            <div className="mb-4">
              <AvatarPanel
                state={llm.state}
                speechEnergy={llm.speechEnergy}
                t={t}
                questionText={undefined}
                onRepeat={llm.repeat}
                onSkip={llm.skip}
              />
            </div>

            {/* Dialog list */}
            <div className="mb-3">
              <div className="text-sm text-gray-500 mb-2">Діалог</div>
              <div className="max-h-132 overflow-auto pr-1">
                <TranscriptList messages={llm.messages} />
              </div>
            </div>

            {/* Controls */}
            <div className="mt-auto pt-2">
              <Controls
                onRepeat={llm.repeat}
                onSkip={llm.skip}
                canSkip={llm.canSkip}
                isAndroid={isAndroid}
                asr={asr}
              />
              {llm.state === 'listening' && (
                <div className="mt-2 text-xs text-gray-500">ASR: Web Speech активний…</div>
              )}
            </div>
          </div>
        </div>
      )}

      {view === 'report' && (
        <div className="flex-1 p-4 max-w-5xl mx-auto w-full">
          <ErrorBoundary>
            <ScoreCard
              photoDataUrl={photoDataUrl}
              report={safeReport}
              messages={llm.messages}
            />
          </ErrorBoundary>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [authorized, setAuthorized] = useState(false)
  const [email, setEmail] = useState<string>('')
  return authorized ? <InterviewApp userEmail={email} /> : <Auth onSuccess={(em) => { setEmail(em); setAuthorized(true) }} />
}