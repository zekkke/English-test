type Props = {
  open: boolean
  onAccept: () => void
  t: (k: string) => string
}

export function ConsentModal({ open, onAccept, t }: Props) {
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="max-w-lg w-full bg-gray-900 border border-white/10 rounded-xl p-6">
        <div className="text-xl font-semibold mb-3">{t('consent.title')}</div>
        <div className="text-sm text-white/80 space-y-2">
          <p>{t('consent.body1')}</p>
          <p>{t('consent.body2')}</p>
        </div>
        <div className="mt-4 flex items-center justify-end">
          <button className="px-3 py-1.5 rounded bg-brand-600 hover:bg-brand-700" onClick={onAccept}>{t('consent.accept')}</button>
        </div>
      </div>
    </div>
  )
}


