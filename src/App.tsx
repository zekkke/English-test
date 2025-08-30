import { useCallback, useEffect, useMemo, useState } from 'react'
import { Controls } from './components/Controls.tsx'
import { CameraPanel } from './components/CameraPanel.tsx'
import { AvatarPanel } from './components/AvatarPanel.tsx'
import { TranscriptList } from './components/TranscriptList.tsx'
import { ScoreCard } from './components/ScoreCard.tsx'
import { ConsentModal } from './components/ConsentModal.tsx'
import { useRTC } from './hooks/useRTC.ts'
import { useLLMRealtime } from './hooks/useLLMRealtime.ts'
import { useScoring } from './hooks/useScoring.ts'
import { useI18n } from './i18n/useI18n.ts'
import { QUESTIONS } from './llm/questions.ts'
import { useWebSpeechASR } from './hooks/useWebSpeechASR.ts'

export default function App() {
  const { t } = useI18n()
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
    if (llm.state === 'finished') setView('report')
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
      <header className="px-4 py-3 border-b border-white/10 bg-black/30 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div>
            <div className="text-lg font-semibold">AI English Interviewer</div>
            <div className="text-xs text-white/60">{t(`state.${llm.state}`)} • {current}/{total}</div>
          </div>
          <div className="w-56 h-2 bg-white/10 rounded">
            <div className="h-2 bg-brand-600 rounded" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </header>
      <ConsentModal open={!consented} onAccept={() => setConsented(true)} t={t} />
      {view === 'interview' && (
        <div className="flex-1 max-w-6xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
          <div className="rounded-xl border border-white/10 p-3 bg-black/30">
            <CameraPanel
              stream={rtc.stream}
              isRecording={llm.state === 'listening' || llm.state === 'speaking'}
              micLevel={rtc.micLevel}
              onSnapshot={(url) => setPhotoDataUrl(url)}
              elapsedSeconds={elapsedSeconds}
            />
          </div>
          <div className="rounded-xl border border-white/10 p-3 bg-black/30 flex flex-col">
            {llm.state === 'idle' && (
              <div className="mb-2 flex justify-end">
                <button
                  className="h-10 px-5 rounded-md bg-brand-600 hover:bg-brand-700 text-sm font-medium"
                  onClick={async () => { await unlockAudio(); llm.start() }}
                >Почати</button>
              </div>
            )}
            <AvatarPanel
              state={llm.state}
              speechEnergy={llm.speechEnergy}
              t={t}
              questionText={llm.messages.filter(m => m.role === 'assistant').slice(-1)[0]?.text}
              onRepeat={llm.repeat}
              onSkip={llm.skip}
            />
            <div className="mt-3 flex-1 overflow-auto pr-1">
              <TranscriptList messages={llm.messages} />
            </div>
            <div className="mt-3 sticky bottom-0 bg-black/10 backdrop-blur rounded-md p-2">
              <Controls
                onRepeat={llm.repeat}
                onSkip={llm.skip}
                canSkip={llm.canSkip}
                isAndroid={isAndroid}
                asr={asr}
              />
              {llm.state === 'listening' && (
                <div className="mt-2 text-xs text-white/60">ASR: Web Speech активний…</div>
              )}
            </div>
          </div>
        </div>
      )}
      {view === 'report' && (
        <div className="flex-1 p-4 max-w-5xl mx-auto w-full">
          <ScoreCard
            photoDataUrl={photoDataUrl}
            report={scoring.finalize(llm.analysis)}
            messages={llm.messages}
          />
        </div>
      )}
    </div>
  )
}