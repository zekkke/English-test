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
          className="h-10 px-4 rounded-full text-sm font-medium text-gray-800 shadow transition-all duration-200 bg-[linear-gradient(to_right,_#e7eaf1,_#92EBFF)] hover:opacity-95"
          onClick={onRepeat}
        >Повторити питання (R)</button>
        <button
          className="h-10 px-6 rounded-full text-sm font-medium text-white shadow transition-all duration-200 bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-700 hover:to-brand-600 disabled:opacity-40"
          onClick={onSkip}
          disabled={!canSkip}
        >Далі</button>
      </div>
      <div>
        {isAndroid && asr && (
          <button
            className="h-10 px-4 rounded-full text-sm font-medium text-white shadow transition-all duration-200 bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-700 hover:to-brand-600"
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