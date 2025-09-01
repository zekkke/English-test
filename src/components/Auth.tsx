import { useEffect, useMemo, useRef, useState } from 'react'
import { uploadUserPhoto, insertInterviewMetrics } from '../services/supabaseService.ts'

type View = 'welcome' | 'signup' | 'login' | 'success'

type Props = {
  onSuccess?: (email: string) => void
}

// In-memory mock "DB"
const signupStore: Map<string, { code: string; photo: string | null; ts: number; storagePath?: string }> = new Map()

function generateCode(): string {
  const n = Math.floor(Math.random() * 1000000)
  return n.toString().padStart(6, '0')
}

export default function Auth({ onSuccess }: Props) {
  const [view, setView] = useState<View>('welcome')

  // Sign up form state
  const [suEmail, setSuEmail] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Camera
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [camError, setCamError] = useState<string | null>(null)

  // Log in form state
  const [liEmail, setLiEmail] = useState('')
  const [liCode, setLiCode] = useState('')

  const emailRegex = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/, [])
  const suValidEmail = emailRegex.test(suEmail)
  const liValid = emailRegex.test(liEmail) && /^\d{6}$/.test(liCode)

  // Autofocus
  const signupEmailRef = useRef<HTMLInputElement | null>(null)
  const loginEmailRef = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    if (view === 'signup') signupEmailRef.current?.focus()
    if (view === 'login') loginEmailRef.current?.focus()
  }, [view])

  // Open camera on entering signup
  useEffect(() => {
    async function openCam() {
      setCamError(null)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 180 }, audio: false })
        streamRef.current = stream
        if (videoRef.current) {
          ;(videoRef.current as HTMLVideoElement).srcObject = stream
          try { await (videoRef.current as HTMLVideoElement).play() } catch {}
        }
      } catch (e: any) {
        setCamError('Не вдалося отримати доступ до камери. Перевірте дозвіл або наявність пристрою.')
      }
    }
    if (view === 'signup') {
      openCam()
    }
    return () => {
      if (view !== 'signup') return
      const s = streamRef.current
      if (s) s.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  const takePhoto = () => {
    setError(null)
    if (!videoRef.current) return
    try {
      const canvas = document.createElement('canvas')
      const v = videoRef.current
      const w = (v as HTMLVideoElement).videoWidth || 320
      const h = (v as HTMLVideoElement).videoHeight || 180
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(v as HTMLVideoElement, 0, 0, w, h)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
      setPhotoUrl(dataUrl)
    } catch (e: any) {
      setError('Не вдалося зробити фото.')
    }
  }

  const handleSignupConfirm = async () => {
    setInfo(null); setError(null)
    if (!suValidEmail) { setError('Некоректний e‑mail.'); return }
    const code = generateCode()

    // Upload photo to Supabase Storage (bucket: English test/sessions/<email>/photo_*.jpg)
    let storagePath: string | undefined
    try {
      if (photoUrl) {
        const { path } = await uploadUserPhoto(suEmail, photoUrl)
        storagePath = path
      }
    } catch (e: any) {
      console.error('Upload photo failed', e)
      setError('Не вдалося завантажити фото до сховища. Перевірте .env для Supabase.')
      return
    }

    // Надіслати код на пошту через dev middleware Resend
    try {
      const r = await fetch('/api/email/send-code', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: suEmail, code })
      })
      if (!r.ok) throw new Error(`email send failed: ${r.status}`)
      setInfo('Код надіслано на вашу пошту')
    } catch (e: any) {
      console.warn('Email send failed', e)
      setInfo('Код згенеровано, але лист не вдалося надіслати. Перевірте налаштування .env (RESEND_API_KEY/RESEND_FROM).')
    }

    signupStore.set(suEmail, { code, photo: photoUrl ?? null, ts: Date.now(), storagePath })

    // Перехід на логін з підставленим e‑mail
    setTimeout(() => {
      setLiEmail(suEmail)
      setLiCode('')
      setView('login')
    }, 700)
  }

  const handleLoginConfirm = async () => {
    setInfo(null); setError(null)
    if (!liValid) { setError('Перевірте e‑mail і 6‑значний код.'); return }

    // TODO: POST /login — перевірити e‑mail та код на бекенді
    // const res = await fetch('/api/login', { method: 'POST', body: JSON.stringify({ email: liEmail, code: liCode }) })

    const rec = signupStore.get(liEmail)
    if (!rec || rec.code !== liCode) { setError('Невірний e‑mail або код.'); return }

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
              <button
                className="w-full h-11 rounded-2xl text-sm font-medium text-white bg-gradient-to-r from-brand-600 to-brand-700 shadow"
                onClick={() => setView('login')}
              >Log in</button>
            </div>
          </div>
        )}

        {view === 'signup' && (
          <div className="rounded-2xl bg-[linear-gradient(to_bottom_right,_#6F6F6F,_#313131)] shadow-lg p-6 text-white">
            <div className="text-xl font-semibold mb-4">Create account</div>
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

            <div className="mt-4">
              <div className="text-sm mb-2">Camera preview</div>
              <div className="aspect-video rounded-xl bg-black/60 flex items-center justify-center overflow-hidden">
                {photoUrl ? (
                  <img src={photoUrl} alt="preview" className="w-full h-full object-contain" />
                ) : camError ? (
                  <div className="p-3 text-xs text-red-200 text-center">{camError}</div>
                ) : (
                  <video ref={videoRef} playsInline muted className="w-full h-full object-contain" />
                )}
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                className="h-10 px-4 rounded-2xl text-sm font-medium text-gray-900 bg-[linear-gradient(to_right,_#e7eaf1,_#92EBFF)] shadow disabled:opacity-50"
                onClick={takePhoto}
                disabled={!!camError}
              >Take a photo</button>
              <button
                className="h-10 px-5 rounded-2xl text-sm font-medium text-white bg-gradient-to-r from-brand-600 to-brand-700 shadow disabled:opacity-40"
                disabled={!suValidEmail}
                onClick={handleSignupConfirm}
              >Confirm</button>
            </div>

            {info && <div className="mt-3 text-xs text-emerald-200">{info}</div>}
            {error && <div className="mt-2 text-xs text-red-200">{error}</div>}

            <p className="mt-4 text-xs text-white/70">
              Натискаючи Take a photo/Confirm, ви погоджуєтесь з тимчасовою обробкою зображення вашого обличчя та e‑mail виключно для демо. Дані не передаються третім особам. Доступ до камери можна відкликати в налаштуваннях браузера.
            </p>

            <div className="mt-4 text-sm">
              Уже є акаунт?{' '}
              <button className="underline" onClick={() => setView('login')}>Log in</button>
            </div>
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
