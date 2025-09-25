import { useState } from 'react'

type Props = {
  state: 'idle' | 'greeting' | 'asking' | 'listening' | 'speaking' | 'analyzing' | 'finished'
  speechEnergy: number
  t: (k: string) => string
  questionText?: string
  onRepeat?: () => void
  onSkip?: () => void
}

export function AvatarPanel({ state, speechEnergy, t }: Props) {
  const isSpeaking = state === 'speaking'
  const isListening = state === 'listening'
  const [useGifFallback, setUseGifFallback] = useState(false)

  const videoMp4 = isSpeaking ? '/assets/animations/avatar-speaking.mp4' : '/assets/animations/avatar-idle.mp4'
  const imageGif = isSpeaking ? '/assets/animations/avatar-speaking.gif' : '/assets/animations/avatar-idle.gif'

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="relative h-24 w-24 rounded-full overflow-hidden shadow">
          {!useGifFallback ? (
            <video
              key={videoMp4}
              src={videoMp4}
              autoPlay
              loop
              muted
              playsInline
              className="h-full w-full object-cover"
              onError={() => setUseGifFallback(true)}
            />
          ) : (
            <img src={imageGif} className="h-full w-full object-cover" alt="avatar" />
          )}
        </div>
        <div className="flex-1">
          <div className="text-sm text-gray-500">{t(`state.${state}`)}</div>
          <div className="h-2 bg-gray-100 rounded mt-2 overflow-hidden">
            <div className="h-2 bg-brand-600" style={{ width: `${state === 'finished' ? 100 : Math.min(100, (isListening ? 100 : speechEnergy * 100))}%` }} />
          </div>
        </div>
      </div>
    </div>
  )
}



