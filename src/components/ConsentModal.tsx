import { useMemo, useState } from 'react'

type Props = {
  open: boolean
  onAccept: () => void
  t: (k: string) => string
  mode?: 'speaking' | 'writing'
}

export function ConsentModal({ open, onAccept, t, mode = 'speaking' }: Props) {
  const [agreed, setAgreed] = useState(false)
  const body1 = mode === 'writing' ? t('consent.writing.body1') : t('consent.body1')
  const body2 = mode === 'writing' ? t('consent.writing.body2') : t('consent.body2')
  const paragraphs = useMemo(() => {
    const join = `${body1}\n\n${body2}`
    return String(join).split(/\n\n+/).map(s => s.trim()).filter(Boolean)
  }, [body1, body2])
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="max-w-2xl w-full bg-gray-900 border border-white/10 rounded-xl p-6">
        <div className="text-xl font-semibold mb-3 text-center">{t('consent.title')}</div>
        <div className="text-sm text-white/80 space-y-3 text-center">
          {paragraphs.map((p, i) => (<p key={i}>{p}</p>))}
        </div>
        {(mode === 'writing' || mode === 'speaking') && (
          <div className="mt-5 flex items-center justify-center gap-3">
            <input id="consent-cb" type="checkbox" className="h-4 w-4" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <label htmlFor="consent-cb" className="text-sm select-none text-white">{t('consent.checkbox')}</label>
          </div>
        )}
        <div className="mt-4 flex items-center justify-center">
          <button
            className="px-4 py-2 rounded-full bg-brand-600 hover:bg-brand-700 disabled:opacity-40"
            onClick={() => (agreed && onAccept())}
            disabled={!agreed}
          >{t('consent.accept')}</button>
        </div>
      </div>
    </div>
  )
}


