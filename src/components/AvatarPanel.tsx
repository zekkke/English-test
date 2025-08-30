import { motion } from 'framer-motion'

type Props = {
  state: 'idle' | 'greeting' | 'asking' | 'listening' | 'speaking' | 'analyzing' | 'finished'
  speechEnergy: number
  t: (k: string) => string
  questionText?: string
  onRepeat?: () => void
  onSkip?: () => void
}

export function AvatarPanel({ state, speechEnergy, t, questionText, onRepeat, onSkip }: Props) {
  const mouthScale = Math.max(0.2, Math.min(1, speechEnergy * 2))
  const isSpeaking = state === 'speaking'
  const isListening = state === 'listening'

  return (
    <div>
      <div className="flex items-center gap-3">
        <motion.div
          className="relative h-24 w-24 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center"
          animate={{
            scale: isListening ? [1, 1.03, 1] : 1,
          }}
          transition={{ repeat: isListening ? Infinity : 0, duration: 1.6 }}
        >
          <div className="absolute top-6 h-3 w-10 bg-white/90 rounded-full" />
          <motion.div
            className="absolute bottom-7 h-3 w-10 bg-white/90 rounded-full"
            animate={{ scaleY: isSpeaking ? mouthScale : 0.25 }}
            transition={{ type: 'tween', duration: 0.08 }}
          />
        </motion.div>
        <div className="flex-1">
          <div className="text-sm text-white/80">{t(`state.${state}`)}</div>
          <div className="h-2 bg-white/10 rounded mt-2 overflow-hidden">
            <div className="h-2 bg-brand-600" style={{ width: `${state === 'finished' ? 100 : Math.min(100, speechEnergy * 100)}%` }} />
          </div>
        </div>
      </div>
      {questionText && (
        <div className="mt-3">
          <div
            className="inline-block max-w-full cursor-pointer rounded-2xl bg-white shadow px-4 py-2 text-sm text-gray-900"
            onClick={onRepeat}
            title="Repeat"
          >{questionText}</div>
          <div className="mt-2 flex items-center gap-2">
            <button className="h-8 px-3 rounded-md bg-white text-gray-800 border border-gray-200 text-xs" onClick={onRepeat}>Repeat</button>
            <button className="h-8 px-3 rounded-md bg-gray-900 text-white text-xs" onClick={onSkip}>Skip</button>
          </div>
        </div>
      )}
    </div>
  )
}



