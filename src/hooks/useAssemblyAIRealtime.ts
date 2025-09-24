type Options = {
  getUserMediaStream: () => MediaStream | null
  onFinal: (text: string) => void
  onPartial?: (text: string) => void
  onError?: (err: unknown) => void
  onStart?: () => void
  onStop?: () => void
  autoRestart?: boolean
  candidateId?: string
  sessionId?: string
}

import { useCallback, useRef } from 'react'

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
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      acc += buffer[i]
      count++
    }
    result[offsetResult] = acc / count
    offsetResult++
    offsetBuffer = nextOffsetBuffer
  }
  return floatTo16BitPCM(result)
}

export function useAssemblyAIRealtime({ getUserMediaStream, onFinal, onPartial, onError, onStart, onStop, autoRestart = false, candidateId, sessionId }: Options) {
  const wsRef = useRef<WebSocket | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const procRef = useRef<ScriptProcessorNode | null>(null)
  const srcRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const runningRef = useRef(false)
  const sampleRate = Number((import.meta as any).env.VITE_ASSEMBLYAI_SAMPLE_RATE) || 16000
  const logEnabled = true

  const postLog = async (kind: 'partial' | 'final' | 'error' | 'info', text?: string, meta?: unknown) => {
    if (!logEnabled || !candidateId || !sessionId) return
    try {
      await fetch('/api/supabase/speech-log', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_id: candidateId, session_id: sessionId, kind, text, meta, ts: new Date().toISOString() })
      })
    } catch {}
  }

  const connect = async () => {
    try {
      const tokenResp = await fetch('/api/assemblyai/token', { method: 'POST' })
      const tokenJson = await tokenResp.json().catch(() => ({}))
      const token = tokenJson?.token || tokenJson?.access_token
      if (!token) throw new Error('No AssemblyAI token')
      const url = `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=${sampleRate}&token=${encodeURIComponent(token)}`
      const ws = new WebSocket(url)
      wsRef.current = ws
      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data as string)
          if (data.message_type === 'PartialTranscript') {
            const t = String(data.text || '')
            try { console.log('[ASR][AssemblyAI] partial:', t) } catch {}
            onPartial?.(t)
            postLog('partial', t)
          }
          if (data.message_type === 'FinalTranscript') {
            const t = String(data.text || '')
            try { console.log('[ASR][AssemblyAI] final:', t) } catch {}
            onFinal(t)
            postLog('final', t)
          }
        } catch {}
      }
      ws.onerror = (e) => { try { console.error('[ASR][AssemblyAI] ws error:', e) } catch {}; try { onError?.(e) } catch {}; postLog('error', undefined, { error: String((e as any)?.message || e) }) }
      ws.onclose = () => {
        wsRef.current = null
        try { console.log('[ASR][AssemblyAI] ws closed') } catch {}
        postLog('info', 'ws_closed')
        if (autoRestart && runningRef.current) start()
      }
    } catch (e) {
      try { console.error('[ASR][AssemblyAI] connect error:', e) } catch {}
      try { onError?.(e) } catch {}
      postLog('error', undefined, { error: String((e as any)?.message || e) })
    }
  }

  const start = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    await connect()
    try { console.log('[ASR][AssemblyAI] start') } catch {}
    try { onStart?.() } catch {}
    postLog('info', 'start')
    let ctx = ctxRef.current
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    ctxRef.current = ctx
    // Очікуємо наявність мікрофонного потоку (до 3с)
    let stream = getUserMediaStream()
    let waitMs = 0
    while (!stream && waitMs < 3000) {
      await new Promise(r => setTimeout(r, 100))
      waitMs += 100
      stream = getUserMediaStream()
    }
    if (!stream) { try { console.error('[ASR][AssemblyAI] No media stream') } catch {}; try { onError?.('No media stream') } catch {}; return }
    const src = ctx.createMediaStreamSource(stream)
    srcRef.current = src
    const proc = ctx.createScriptProcessor(4096, 1, 1)
    procRef.current = proc
    const sourceRate = ctx.sampleRate
    proc.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0)
      const int16 = downsampleBuffer(input, sourceRate, sampleRate)
      const b64 = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(int16.buffer)) as unknown as number[]))
      try { wsRef.current?.send(JSON.stringify({ audio: b64 })) } catch {}
    }
    src.connect(proc)
    proc.connect(ctx.destination)
  }, [getUserMediaStream])

  const stop = useCallback(() => {
    runningRef.current = false
    try { wsRef.current?.close() } catch {}
    wsRef.current = null
    try { procRef.current?.disconnect(); srcRef.current?.disconnect() } catch {}
    procRef.current = null
    srcRef.current = null
    try { console.log('[ASR][AssemblyAI] stop') } catch {}
    try { onStop?.() } catch {}
    postLog('info', 'stop')
  }, [])

  return { start, stop }
}


