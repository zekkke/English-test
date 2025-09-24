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
  timeExpired?: boolean
  answeredCount?: number
  totalCount?: number
}

export function ScoreCard({ photoDataUrl, report, messages = [], timeExpired = false, answeredCount, totalCount }: Props) {
  const cardRef = useRef<HTMLDivElement | null>(null)
  const subs = report?.subscores ?? { fluency: 0, pronunciation: 0, grammar: 0, lexical: 0, coherence: 0 }
  const keys: Array<keyof typeof subs> = ['fluency', 'pronunciation', 'grammar', 'lexical', 'coherence']

  const downloadPdf = async () => {
    try {
      const node = cardRef.current
      if (!node) return
      await new Promise((r) => requestAnimationFrame(() => r(null)))

      await (document as any).fonts?.ready?.catch?.(() => null)
      const baseOptions = {
        backgroundColor: '#ffffff',
        scale: Math.min(2, window.devicePixelRatio || 1.5),
        useCORS: true,
        allowTaint: true,
        logging: false,
        windowWidth: node.scrollWidth || node.clientWidth,
        windowHeight: node.scrollHeight || node.clientHeight,
      } as const

      const desiredScale = Math.max(2, (baseOptions as unknown as { scale?: number }).scale || 2)
      let canvas = await html2canvas(node, { ...baseOptions, foreignObjectRendering: false, scale: desiredScale })

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
      alert('Failed to generate PDF. Please try again.')
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {timeExpired && (
        <div className="mb-3 rounded-lg border border-red-300 bg-red-50 text-red-800 px-4 py-2">
          You did not finish within the allotted time and did not pass the test. {typeof answeredCount === 'number' && typeof totalCount === 'number' ? `Answered ${answeredCount} of ${totalCount} questions.` : ''}
        </div>
      )}
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
            <div className="text-sm text-gray-600">Candidate summary card</div>
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
          <div className="mb-2">Feedback</div>
          <div className="rounded-lg p-3 text-sm bg-gray-50 border border-gray-200">{report?.feedback ?? '—'}</div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4">
          <div>
            <div className="mb-2">Key errors</div>
            <ul className="list-disc list-inside text-sm space-y-1">
              {(report?.keyErrors ?? []).map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
          <div>
            <div className="mb-2">Rephrase suggestions</div>
            <ul className="list-disc list-inside text-sm space-y-1">
              {(report?.rephrases ?? []).map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-2">Dialog history</div>
          <div className="rounded-lg p-3 bg-gray-50 border border-gray-200">
            <ul className="space-y-1 text-sm">
              {messages.filter(m => m.role !== 'analysis').map((m, i) => (
                <li key={i}><span style={{ fontWeight: 500 }}>{m.role === 'assistant' ? 'AI' : 'You'}:</span> {m.text}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 justify-end">
        <button className="px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200 border border-gray-300" onClick={downloadPdf}>Download PDF</button>
      </div>
    </div>
  )
}