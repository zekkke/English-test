type Props = {
  onRepeat: () => void
  onFinishAnswer?: () => void
  isAndroid?: boolean
  asr?: { start: () => boolean; stop: () => void }
}

export function Controls({ onRepeat, onFinishAnswer, isAndroid = false, asr }: Props) {
  const handleFinish = () => {
    try {
      // UI log for diagnostics
      console.log('[UI] Finish answer clicked')
      onFinishAnswer?.()
    } catch (e) {
      try { console.error('[UI] Finish answer error', e) } catch {}
    }
  }
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <button
          className="h-10 px-4 rounded-full text-sm font-medium text-gray-800 shadow transition-all duration-200 bg-[linear-gradient(to_right,_#e7eaf1,_#92EBFF)] hover:opacity-95"
          onClick={onRepeat}
        >Repeat question</button>
        {/* Next button removed as per new flow */}
        <button
          className="relative z-10 h-10 px-6 rounded-full text-sm font-medium text-white shadow transition-all duration-200 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-700 hover:to-sky-600 disabled:opacity-40"
          onClick={handleFinish}
          disabled={!onFinishAnswer}
        >Finish answer</button>
      </div>
      <div>
        {isAndroid && asr && (
          <button
            className="h-10 px-4 rounded-full text-sm font-medium text-white shadow transition-all duration-200 bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-700 hover:to-brand-600"
            onMouseDown={() => { try { asr.start() } catch {} }}
            onMouseUp={() => { try { asr.stop() } catch {} }}
            onTouchStart={() => { try { asr.start() } catch {} }}
            onTouchEnd={() => { try { asr.stop() } catch {} }}
          >Hold to speak</button>
        )}
      </div>
    </div>
  )
}