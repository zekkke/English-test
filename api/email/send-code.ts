export const config = { runtime: 'nodejs' }

import { Resend } from 'resend'

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  try {
    const { to, code } = await req.json()
    if (!to || !code) return new Response('to and code are required', { status: 400 })

    const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
    const RESEND_FROM = process.env.RESEND_FROM || 'no-reply@example.com'
    if (!RESEND_API_KEY) return new Response('RESEND_API_KEY missing', { status: 500 })

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
    const r = await resend.emails.send({ from: RESEND_FROM, to, subject, html })
    if ((r as any)?.error) return new Response(String((r as any).error), { status: 500 })
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (e: any) {
    return new Response(String(e?.message || e), { status: 500 })
  }
}



