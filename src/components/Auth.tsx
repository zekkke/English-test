import { useEffect, useMemo, useRef, useState } from 'react'
import { insertInterviewMetrics } from '../services/supabaseService.ts'

type View = 'welcome' | 'signup' | 'login' | 'success'

type Props = {
  onSuccess?: (email: string) => void
}

// (email-code flow видалено)

export default function Auth({ onSuccess }: Props) {
  const [view, setView] = useState<View>('welcome')

  // Sign up form state
  const [suEmail, setSuEmail] = useState('')
  const [suFirstName, setSuFirstName] = useState('')
  const [suLastName, setSuLastName] = useState('')
  const [info, setInfo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Log in form state
  const [liEmail, setLiEmail] = useState('')
  const [liCode, setLiCode] = useState('')

  const emailRegex = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/, [])
  const suValidEmail = emailRegex.test(suEmail)
  const suValidNames = suFirstName.trim().length > 1 && suLastName.trim().length > 1
  const liValid = emailRegex.test(liEmail) && /^\d{6}$/.test(liCode)

  // Feature flag: e-mail delivery can be disabled without removing code paths
  // Email flow вимкнений; прапор збережено на майбутнє
  // const EMAIL_ENABLED = (import.meta as any).env.VITE_EMAIL_ENABLED === 'true'

  // Autofocus
  const signupFirstRef = useRef<HTMLInputElement | null>(null)
  const signupEmailRef = useRef<HTMLInputElement | null>(null)
  const loginEmailRef = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    if (view === 'signup') signupFirstRef.current?.focus()
    if (view === 'login') loginEmailRef.current?.focus()
  }, [view])

  // Камера/фото більше не використовуються під час реєстрації

  const handleSignupConfirm = async () => {
    setInfo(null); setError(null)
    if (!suValidEmail) { setError('Некоректний e‑mail.'); return }
    if (!suValidNames) { setError('Вкажіть ім’я та прізвище (мін. 2 символи).'); return }

    // Одразу створюємо початковий запис метрик і пускаємо до тесту
    try {
      await insertInterviewMetrics({
        candidate_id: suEmail,
        session_id: `${suEmail}-${Date.now()}`,
        privacy_events: { firstName: suFirstName.trim(), lastName: suLastName.trim() },
        raw_key: 'signup',
      })
    } catch (e: any) {
      console.error('Insert metrics (signup) failed', e)
      setError('Не вдалося зробити початковий запис метрик. Перевірте таблицю/права.')
      return
    }

    setView('success')
    setTimeout(() => onSuccess?.(suEmail), 500)
  }

  const handleLoginConfirm = async () => {
    setInfo(null); setError(null)
    if (!liValid) { setError('Перевірте e‑mail і 6‑значний код.'); return }

    // TODO: POST /login — перевірити e‑mail та код на бекенді
    // const res = await fetch('/api/login', { method: 'POST', body: JSON.stringify({ email: liEmail, code: liCode }) })

    // Демологін: приймаємо будь-який 6-значний код. У продакшені тут буде бекенд‑перевірка
    const rec = { storagePath: 'signup' }

    // Insert initial interview_metrics row
    try {
      await insertInterviewMetrics({
        candidate_id: liEmail,
        session_id: `${liEmail}-${Date.now()}`,
        face_present: undefined,
        in_frame_ratio: undefined,
        gaze_in_screen: undefined,
        lighting_ok: undefined,
        image_quality_score: undefined,
        privacy_events: undefined,
        raw_key: rec?.storagePath ?? 'signup',
      })
    } catch (e: any) {
      console.error('Insert metrics failed', e)
      setError('Не вдалося зробити початковий запис метрик. Перевірте таблицю/права.')
      return
    }

    setView('success')
    setTimeout(() => onSuccess?.(liEmail), 500)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {view === 'welcome' && (
          <div className="rounded-2xl bg-[linear-gradient(to_bottom_right,_#6F6F6F,_#313131)] shadow-lg p-8 text-white">
            <div className="text-2xl font-semibold mb-6">Welcome</div>
            <div className="space-y-3">
              <button
                className="w-full h-11 rounded-2xl text-sm font-medium text-gray-900 bg-[linear-gradient(to_right,_#e7eaf1,_#92EBFF)] shadow"
                onClick={() => setView('signup')}
              >Sign up</button>
            </div>
          </div>
        )}

        {view === 'signup' && (
          <div className="rounded-2xl bg-[linear-gradient(to_bottom_right,_#6F6F6F,_#313131)] shadow-lg p-6 text-white">
            <div className="text-xl font-semibold mb-4">Create account</div>
            <label className="block text-sm mb-1" htmlFor="signup-first">First name</label>
            <input
              id="signup-first"
              ref={signupFirstRef}
              aria-label="First name"
              type="text"
              placeholder="John"
              value={suFirstName}
              onChange={(e) => setSuFirstName(e.target.value)}
              className="w-full h-11 rounded-xl px-3 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
            <label className="block text-sm mt-3 mb-1" htmlFor="signup-last">Last name</label>
            <input
              id="signup-last"
              aria-label="Last name"
              type="text"
              placeholder="Doe"
              value={suLastName}
              onChange={(e) => setSuLastName(e.target.value)}
              className="w-full h-11 rounded-xl px-3 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
            <label className="block text-sm mb-1" htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
              ref={signupEmailRef}
              aria-label="Email for sign up"
              type="email"
              placeholder="you@example.com"
              value={suEmail}
              onChange={(e) => setSuEmail(e.target.value)}
              className="w-full h-11 rounded-xl px-3 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-600"
            />

            <div className="mt-4 flex items-center gap-2">
              <button
                className="h-10 px-5 rounded-2xl text-sm font-medium text-white bg-gradient-to-r from-brand-600 to-brand-700 shadow disabled:opacity-40"
                disabled={!suValidEmail || !suValidNames}
                onClick={handleSignupConfirm}
              >Confirm</button>
            </div>

            {info && <div className="mt-3 text-xs text-emerald-200">{info}</div>}
            {error && <div className="mt-2 text-xs text-red-200">{error}</div>}

            <p className="mt-4 text-xs text-white/70">Натискаючи Confirm, ви погоджуєтесь з обробкою e‑mail та П.І.Б. виключно для демо.</p>
          </div>
        )}

        {view === 'login' && (
          <div className="rounded-2xl bg-[linear-gradient(to_bottom_right,_#6F6F6F,_#313131)] shadow-lg p-6 text-white">
            <div className="text-xl font-semibold mb-4">Log in</div>
            <label className="block text-sm mb-1" htmlFor="login-email">Email</label>
            <input
              id="login-email"
              ref={loginEmailRef}
              aria-label="Email for log in"
              type="email"
              placeholder="you@example.com"
              value={liEmail}
              onChange={(e) => setLiEmail(e.target.value)}
              className="w-full h-11 rounded-xl px-3 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
            <label className="block text-sm mt-4 mb-1" htmlFor="login-code">Code</label>
            <input
              id="login-code"
              aria-label="6-digit access code"
              inputMode="numeric"
              pattern="\\d{6}"
              maxLength={6}
              placeholder="000000"
              value={liCode}
              onChange={(e) => setLiCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
              className="w-full h-11 rounded-xl px-3 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-600"
            />

            <div className="mt-4 flex items-center gap-2">
              <button
                className="h-10 px-5 rounded-2xl text-sm font-medium text-white bg-gradient-to-r from-brand-600 to-brand-700 shadow disabled:opacity-40"
                disabled={!liValid}
                onClick={handleLoginConfirm}
              >Confirm</button>
              <button className="h-10 px-4 rounded-2xl text-sm font-medium bg-white/20" onClick={() => setView('signup')}>Back</button>
            </div>

            {info && <div className="mt-3 text-xs text-emerald-200">{info}</div>}
            {error && <div className="mt-2 text-xs text-red-200">{error}</div>}
          </div>
        )}

        {view === 'success' && (
          <div className="rounded-2xl bg-[linear-gradient(to_bottom_right,_#6F6F6F,_#313131)] shadow-lg p-8 text-white text-center">
            <div className="text-2xl font-semibold mb-2">Success</div>
            <div className="text-sm text-white/80">Вхід виконано. Можна переходити до тесту.</div>
          </div>
        )}
      </div>
    </div>
  )
}