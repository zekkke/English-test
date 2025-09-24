export const config = { runtime: 'nodejs' }

import { Resend } from 'resend'

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)
  try {
    const { to, code, from, replyTo } = await req.json()
    if (!to || !code) return json({ error: 'to and code are required' }, 400)

    const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
    const ENV_FROM = process.env.RESEND_FROM
    const fallbackFrom = 'onboarding@resend.dev'
    const fromAddress = String(from || ENV_FROM || fallbackFrom)
    const replyToAddress = process.env.RESEND_REPLY_TO || replyTo
    if (!RESEND_API_KEY) return json({ error: 'RESEND_API_KEY missing' }, 500)

    const resend = new Resend(RESEND_API_KEY)
    const subject = 'Ваш код доступу до AI English Interviewer'
    const html = `
      <div style="font-family:Inter,Segoe UI,Arial,sans-serif;line-height:1.6;color:#0f172a">
        <h2 style="margin:0 0 12px">Підтвердження входу</h2>
        <p>Ваш одноразовий код доступу:</p>
        <p style="font-size:24px;font-weight:700;letter-spacing:3px;margin:8px 0 16px">${code}</p>
        <p>Код дійсний протягом 10 хвилин. Якщо ви не ініціювали вхід — проігноруйте цей лист.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0" />
        <p style="font-size:12px;color:#64748b">AI English Interviewer</p>
      </div>`
    const payload: any = { from: fromAddress, to, subject, html }
    if (replyToAddress) payload.replyTo = replyToAddress
    const r = await resend.emails.send(payload)
    if ((r as any)?.error) return json({ error: (r as any).error, hint: 'Verify RESEND_FROM domain (SPF/DKIM) or use onboarding@resend.dev' }, 500)
    return json({ ok: true }, 200)
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500)
  }
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })
}