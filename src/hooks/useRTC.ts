import { useCallback, useEffect, useRef, useState } from 'react'

type Params = { enabled: boolean }

export function useRTC({ enabled }: Params) {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [micLevel, setMicLevel] = useState(0)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const srcRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!enabled) return
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        if (cancelled) return
        setStream(s)
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
        audioCtxRef.current = ctx
        const src = ctx.createMediaStreamSource(s)
        srcRef.current = src
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 2048
        analyserRef.current = analyser
        src.connect(analyser)

        const loop = () => {
          if (!analyserRef.current) return
          const data = new Uint8Array(analyserRef.current.frequencyBinCount)
          analyserRef.current.getByteTimeDomainData(data)
          let sum = 0
          for (let i = 0; i < data.length; i++) {
            const val = (data[i] - 128) / 128
            sum += val * val
          }
          const rms = Math.sqrt(sum / data.length)
          setMicLevel(rms)
          setTick((x) => (x + 1) % 1_000_000)
          requestAnimationFrame(loop)
        }
        requestAnimationFrame(loop)
      } catch (e) {
        console.error('getUserMedia failed', e)
      }
    }
    run()
    return () => { cancelled = true }
  }, [enabled])

  const onExternalEnergy = useCallback((energy: number) => {
    setMicLevel(energy)
  }, [])

  return { stream, micLevel, onExternalEnergy, tick }
}


