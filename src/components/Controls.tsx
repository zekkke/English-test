type Props = {
  onRepeat: () => void
  onSkip: () => void
  canSkip: boolean
  isAndroid?: boolean
  asr?: { start: () => boolean; stop: () => void }
}

export function Controls({ onRepeat, onSkip, canSkip, isAndroid = false, asr }: Props) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <button
          className="h-10 px-4 rounded-md bg-white/10 hover:bg-white/15 text-sm font-medium border border-white/10"
          onClick={onRepeat}
        >Повторити питання (R)</button>
        <button
          className="h-10 px-5 rounded-md bg-brand-600 hover:bg-brand-700 text-sm font-medium disabled:opacity-40"
          onClick={onSkip}
          disabled={!canSkip}
        >Далі</button>
      </div>
      <div>
        {isAndroid && asr && (
          <button
            className="h-10 px-4 rounded-md bg-brand-600 hover:bg-brand-700 text-sm font-medium"
            onMouseDown={() => { try { asr.start() } catch {} }}
            onMouseUp={() => { try { asr.stop() } catch {} }}
            onTouchStart={() => { try { asr.start() } catch {} }}
            onTouchEnd={() => { try { asr.stop() } catch {} }}
          >Утримуйте і говоріть</button>
        )}
      </div>
    </div>
  )
}