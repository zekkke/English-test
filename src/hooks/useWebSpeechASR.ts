type ASROptions = {
  lang?: string
  onFinal: (text: string) => void
  onPartial?: (text: string) => void
  autoRestart?: boolean
  onError?: (err: unknown) => void
  continuous?: boolean
  forceFinalOnEnd?: boolean
  onStart?: () => void
  onStop?: () => void
}

type RecognitionType = typeof window & {
  webkitSpeechRecognition?: any
  SpeechRecognition?: any
}

import { useRef } from 'react'

export function useWebSpeechASR({ lang = 'en-US', onFinal, onPartial, autoRestart = true, onError, continuous = true, forceFinalOnEnd = true, onStart, onStop }: ASROptions) {
  const recRef = useRef<any | null>(null)
  const runningRef = useRef(false)
  const lastPartialRef = useRef('')

  const isSupported = () => {
    const w = window as RecognitionType
    return !!(w.SpeechRecognition || w.webkitSpeechRecognition)
  }

  const create = () => {
    const w = window as RecognitionType
    const Cls = w.SpeechRecognition || w.webkitSpeechRecognition
    const rec = new Cls()
    rec.lang = lang
    rec.interimResults = true
    rec.maxAlternatives = 1
    rec.continuous = continuous
    rec.onresult = (e: any) => {
      const res = e.results[e.results.length - 1]
      const text = res[0]?.transcript ?? ''
      if (res.isFinal) {
        lastPartialRef.current = ''
        try { console.log('[ASR][WebSpeech] final:', text) } catch {}
        onFinal(text)
      } else {
        lastPartialRef.current = text
        try { console.log('[ASR][WebSpeech] partial:', text) } catch {}
        onPartial?.(text)
      }
    }
    rec.onerror = (e: unknown) => {
      try { console.error('[ASR][WebSpeech] error:', e) } catch {}
      try { onError?.(e) } catch {}
    }
    rec.onend = () => {
      // Якщо не було фіналу, але є частковий текст — віддаємо як фінал (PTT/мобільні)
      if (forceFinalOnEnd && lastPartialRef.current) {
        try { onFinal(lastPartialRef.current) } catch {}
        lastPartialRef.current = ''
      }
      if (autoRestart && runningRef.current) try { rec.start() } catch {}
      try { console.log('[ASR][WebSpeech] stopped') } catch {}
      try { onStop?.() } catch {}
    }
    return rec
  }

  const start = () => {
    if (!isSupported()) return false
    if (!recRef.current) recRef.current = create()
    runningRef.current = true
    lastPartialRef.current = ''
    try {
      recRef.current.start()
      try { console.log('[ASR][WebSpeech] started') } catch {}
      try { onStart?.() } catch {}
    } catch {}
    return true
  }

  const stop = () => { runningRef.current = false; try { recRef.current?.stop() } catch {}; try { console.log('[ASR][WebSpeech] stop requested') } catch {} }

  return { start, stop, isSupported }
}