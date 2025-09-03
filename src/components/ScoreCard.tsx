import { useRef } from 'react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

type Subscores = {
  fluency: number
  pronunciation: number
  grammar: number
  lexical: number
  coherence: number
}

type Report = {
  cefr: 'A1' | 'A2' | 'B1' | 'B2' | 'C1'
  subscores: Subscores
  feedback: string
  keyErrors: string[]
  rephrases: string[]
}

type Props = {
  photoDataUrl: string | null
  report: Report
  messages?: { role: 'assistant' | 'user' | 'analysis'; text: string; ts?: string }[]
}

export function ScoreCard({ photoDataUrl, report, messages = [] }: Props) {
  const cardRef = useRef<HTMLDivElement | null>(null)
  const subs = report?.subscores ?? { fluency: 0, pronunciation: 0, grammar: 0, lexical: 0, coherence: 0 }
  const keys: Array<keyof typeof subs> = ['fluency', 'pronunciation', 'grammar', 'lexical', 'coherence']

  const downloadPdf = async () => {
    try {
      const node = cardRef.current
      if (!node) return
      // дочекатися ре-лейауту перед знімком
      await new Promise((r) => requestAnimationFrame(() => r(null)))

      // гарантуємо білий фон і рендер усіх елементів
      await (document as any).fonts?.ready?.catch?.(() => null)
      const baseOptions = {
        backgroundColor: '#ffffff',
        scale: Math.min(2, window.devicePixelRatio || 1.5),
        useCORS: true,
        allowTaint: true,
        logging: false,
        windowWidth: node.scrollWidth || node.clientWidth,
        windowHeight: node.scrollHeight || node.clientHeight,
        onclone: (doc: Document) => {
          const root = doc.querySelector('[data-pdf-root]') as HTMLElement | null
          if (root) {
            root.style.backgroundColor = '#ffffff'
            root.style.color = '#111111'
            const properties = ['color','backgroundColor','borderColor','outlineColor','fill','stroke','background'] as const
            // прибрати можливі фільтри/градієнти та конвертувати кольори у rgb
            root.querySelectorAll('*').forEach((node) => {
              const e = node as HTMLElement
              const cs = (doc.defaultView || window).getComputedStyle(e)
              e.style.backdropFilter = 'none'
              e.style.filter = 'none'
              e.style.boxShadow = 'none'
              // Заборона градієнтів/зображень, які можуть містити oklch/oklab
              e.style.backgroundImage = 'none'
              e.style.background = e.style.background || 'transparent'
              e.style.borderImage = 'none'
              properties.forEach((p) => {
                const v = (cs as any)[p]
                if (v && typeof v === 'string') {
                  // браузер повертає обчислене значення (зазвичай rgb/rgba); задаємо інлайном
                  if (/oklch\(|oklab\(/i.test(v)) {
                    // жорсткий фолбек, щоб html2canvas не падав
                    const fallback = p === 'color' || p === 'stroke' ? '#111111' : '#ffffff'
                    ;(e.style as any)[p] = fallback
                  } else {
                    ;(e.style as any)[p] = v
                  }
                }
              })
            })
            // Залишаємо глобальні стилі, щоб не зламати макет; кольори вже інлайн‑нормалізовані
          }
        },
      } as const

      // Спроба №1: рендер самого вузла (вищий scale у проді покращує різкість)
      const desiredScale = Math.max(2, (baseOptions as unknown as { scale?: number }).scale || 2)
      let canvas = await html2canvas(node, { ...baseOptions, foreignObjectRendering: false, scale: desiredScale })

      // Якщо канвас підозріло малий/порожній — Спроба №2: рендер body із кропом по bbox карти
      if (!canvas || canvas.width < 50 || canvas.height < 50) {
        const rect = node.getBoundingClientRect()
        canvas = await html2canvas(document.body, {
          ...baseOptions,
          foreignObjectRendering: false,
          x: Math.floor(rect.left + window.scrollX),
          y: Math.floor(rect.top + window.scrollY),
          width: Math.ceil(rect.width),
          height: Math.ceil(rect.height),
        })
      }

      const imgData = canvas.toDataURL('image/png')
      // Вирівнюємо масштaб і поля, щоб контент поміщався коректно
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 24
      const imgWidth = pageWidth - margin * 2
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      let heightLeft = imgHeight
      let position = 0

      pdf.addImage(imgData, 'PNG', margin, position + margin, imgWidth, imgHeight)
      heightLeft -= pageHeight

      while (heightLeft > 0) {
        position = position - pageHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', margin, position + margin, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      pdf.save('candidate-report.pdf')
    } catch (err) {
      console.error('PDF export error', err)
      alert('Не вдалося згенерувати PDF. Спробуйте ще раз або повідомте про помилку.')
    }
  }

  // n8n відправка відключена на прохання користувача

  return (
    <div className="max-w-4xl mx-auto">
      <div
        ref={cardRef}
        data-pdf-root
        className="rounded-2xl bg-white text-gray-900 shadow-xl border border-gray-200 p-6"
      >
        <div className="flex gap-4 items-center">
          <div className="h-24 w-24 rounded-md overflow-hidden flex items-center justify-center bg-gray-100">
            {photoDataUrl ? <img src={photoDataUrl} className="h-full w-full object-cover" /> : <span className="text-xs text-black">No Photo</span>}
          </div>
          <div>
            <div className="text-2xl font-semibold">CEFR: {report?.cefr ?? 'A1'}</div>
            <div className="text-sm text-gray-600">Підсумкова картка кандидата</div>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-3 mt-5">
          {keys.map((k) => {
            const v = Number((subs as any)[k] ?? 0)
            return (
              <div key={k} className="rounded-lg p-3 text-center bg-gray-50 border border-gray-200">
                <div className="text-sm capitalize">{k}</div>
                <div className="text-2xl font-bold">{isFinite(v) ? v.toFixed(1) : '0.0'}</div>
              </div>
            )
          })}
        </div>
        <div className="mt-5">
          <div className="mb-2">Зворотній зв'язок</div>
          <div className="rounded-lg p-3 text-sm bg-gray-50 border border-gray-200">{report?.feedback ?? '—'}</div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4">
          <div>
            <div className="mb-2">Ключові помилки</div>
            <ul className="list-disc list-inside text-sm space-y-1">
              {(report?.keyErrors ?? []).map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
          <div>
            <div className="mb-2">Приклади перефразувань</div>
            <ul className="list-disc list-inside text-sm space-y-1">
              {(report?.rephrases ?? []).map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-2">Історія діалогу</div>
          <div className="rounded-lg p-3 bg-gray-50 border border-gray-200">
            <ul className="space-y-1 text-sm">
              {messages.filter(m => m.role !== 'analysis').map((m, i) => (
                <li key={i}><span style={{ fontWeight: 500 }}>{m.role === 'assistant' ? 'AI' : 'Ви'}:</span> {m.text}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 justify-end">
        <button className="px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200 border border-gray-300" onClick={downloadPdf}>Завантажити PDF</button>
      </div>
    </div>
  )
}
