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
            const properties = ['color','backgroundColor','borderColor','outlineColor','fill','stroke'] as const
            // прибрати можливі фільтри/градієнти та конвертувати кольори у rgb
            root.querySelectorAll('*').forEach((node) => {
              const e = node as HTMLElement
              const cs = (doc.defaultView || window).getComputedStyle(e)
              e.style.backdropFilter = 'none'
              e.style.filter = 'none'
              e.style.boxShadow = 'none'
              properties.forEach((p) => {
                const v = (cs as any)[p]
                if (v && typeof v === 'string') {
                  // браузер повертає обчислене значення (зазвичай rgb/rgba); задаємо інлайном
                  ;(e.style as any)[p] = v
                }
              })
            })
          }
        },
      } as const

      // Спроба №1: рендер самого вузла
      let canvas = await html2canvas(node, { ...baseOptions, foreignObjectRendering: false })

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
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = pageWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      let heightLeft = imgHeight
      let position = 0

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      while (heightLeft > 0) {
        position = position - pageHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
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
        className="rounded-xl border p-6 text-black"
        style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(0,0,0,0.1)' }}
      >
        <div className="flex gap-4 items-center">
          <div className="h-24 w-24 rounded-md overflow-hidden flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
            {photoDataUrl ? <img src={photoDataUrl} className="h-full w-full object-cover" /> : <span className="text-xs text-black">No Photo</span>}
          </div>
          <div>
            <div className="text-2xl font-semibold">CEFR: {report.cefr}</div>
            <div className="text-black text-sm">Підсумкова картка кандидата</div>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-3 mt-5">
          {Object.entries(report.subscores).map(([k, v]) => (
            <div key={k} className="rounded p-3 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
              <div className="text-sm capitalize">{k}</div>
              <div className="text-2xl font-bold">{v.toFixed(1)}</div>
            </div>
          ))}
        </div>
        <div className="mt-5">
          <div className="text-black mb-2">Зворотній зв'язок</div>
          <div className="rounded p-3 text-sm" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>{report.feedback}</div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4">
          <div>
            <div className="text-black mb-2">Ключові помилки</div>
            <ul className="list-disc list-inside text-sm text-black space-y-1">
              {report.keyErrors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
          <div>
            <div className="text-black mb-2">Приклади перефразувань</div>
            <ul className="list-disc list-inside text-sm text-black space-y-1">
              {report.rephrases.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        </div>

        <div className="mt-6">
          <div className="text-black mb-2">Історія діалогу</div>
          <div className="rounded p-3" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
            <ul className="space-y-1 text-sm">
              {messages.filter(m => m.role !== 'analysis').map((m, i) => (
                <li key={i}><span style={{ fontWeight: 600 }}>{m.role === 'assistant' ? 'AI' : 'Ви'}:</span> {m.text}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 justify-end">
        <button className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/15" onClick={downloadPdf}>Завантажити PDF</button>
      </div>
    </div>
  )
}


