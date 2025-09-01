import { useCallback, useEffect, useRef, useState } from 'react'

type Props = {
  stream: MediaStream | null
  isRecording: boolean
  micLevel: number
  elapsedSeconds: number
  onSnapshot: (dataUrl: string) => void
}

export function CameraPanel({ stream, isRecording, micLevel, onSnapshot, elapsedSeconds }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [canSnapshot, setCanSnapshot] = useState(false)

  useEffect(() => {
    if (videoRef.current && stream) {
      ;(videoRef.current as HTMLVideoElement).srcObject = stream
      const play = async () => {
        try { await (videoRef.current as HTMLVideoElement).play() } catch {}
      }
      play()
      setCanSnapshot(true)
    }
  }, [stream])

  const handleSnapshot = useCallback(() => {
    if (!videoRef.current) return
    const canvas = document.createElement('canvas')
    const video = videoRef.current
    const w = (video as HTMLVideoElement).videoWidth
    const h = (video as HTMLVideoElement).videoHeight
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video as HTMLVideoElement, 0, 0, w, h)
    const dataUrl = canvas.toDataURL('image/png')
    onSnapshot(dataUrl)
  }, [onSnapshot])

  return (
    <div className="relative h-full flex items-center justify-center">
      <div className="relative aspect-video w-11/12 rounded-xl overflow-hidden shadow-inner bg-[#0b0e12] flex items-center justify-center">
        <video ref={videoRef} muted playsInline className="max-w-full max-h-full object-contain" />

        {/* Overlays привʼязані до чорного прямокутника */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span className={`${isRecording ? 'bg-red-500' : 'bg-gray-400'} h-2 w-2 rounded-full`} />
          <span className={`${isRecording ? 'text-red-600' : 'text-gray-300'} text-xs`}>REC</span>
        </div>
        <div className="absolute top-3 right-3">
          <span className="text-xs text-white/80 px-2 py-0.5 rounded bg-black/50">{elapsedSeconds}s</span>
        </div>
        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex items-center gap-3">
            <div className="text-xs text-white/70">Mic</div>
            <div className="h-2 flex-1 bg-white/20 rounded">
              <div className="h-2 rounded bg-emerald-500" style={{ width: `${Math.min(100, Math.floor(micLevel * 100))}%` }} />
            </div>
          </div>
          <button
            className="hidden mt-2 h-9 px-3 text-sm rounded-md bg-white/20 hover:bg-white/30 text-white backdrop-blur border border-white/20 disabled:opacity-50"
            onClick={handleSnapshot}
            disabled={!canSnapshot}
          >Зробити кадр</button>
        </div>
      </div>
    </div>
  )
}


