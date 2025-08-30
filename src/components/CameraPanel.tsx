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
    <div className="relative">
      <div className="aspect-video bg-black rounded-2xl overflow-hidden shadow">
        <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
      </div>
      <div className="absolute top-3 left-3 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`} />
        <span className={`text-xs ${isRecording ? 'text-red-600' : 'text-gray-300'}`}>REC</span>
      </div>
      <div className="absolute top-3 right-3">
        <span className="text-xs text-white/80 px-2 py-0.5 rounded bg-black/50">{elapsedSeconds}s</span>
      </div>
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2 w-28 bg-white/20 rounded">
            <div className="h-2 rounded bg-green-500" style={{ width: `${Math.min(100, Math.floor(micLevel * 100))}%` }} />
          </div>
          <span className="text-xs text-white/80">Mic</span>
        </div>
        <button
          className="hidden h-9 px-3 text-sm rounded-md bg-white/20 hover:bg-white/30 text-white backdrop-blur border border-white/20 disabled:opacity-50"
          onClick={handleSnapshot}
          disabled={!canSnapshot}
        >
          Зробити кадр
        </button>
      </div>
    </div>
  )
}


