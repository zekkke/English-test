type Subscores = { fluency: number; pronunciation: number; grammar: number; lexical: number; coherence: number }
type Report = { cefr: 'A1' | 'A2' | 'B1' | 'B2' | 'C1'; subscores: Subscores; feedback: string; keyErrors: string[]; rephrases: string[] }

type Props = {
  writing: { report: Report }
  speaking: { report: Report }
}

export default function CombinedScoreCard({ writing, speaking }: Props) {
  const avg = (a: number, b: number) => (a + b) / 2
  const subs: Subscores = {
    fluency: avg(writing.report.subscores.fluency, speaking.report.subscores.fluency),
    pronunciation: avg(writing.report.subscores.pronunciation, speaking.report.subscores.pronunciation),
    grammar: avg(writing.report.subscores.grammar, speaking.report.subscores.grammar),
    lexical: avg(writing.report.subscores.lexical, speaking.report.subscores.lexical),
    coherence: avg(writing.report.subscores.coherence, speaking.report.subscores.coherence),
  }
  const weighted = subs.fluency * 0.3 + subs.grammar * 0.25 + subs.lexical * 0.2 + subs.pronunciation * 0.15 + subs.coherence * 0.1
  const cefr = weighted < 1 ? 'A1' : weighted < 2 ? 'A2' : weighted < 3 ? 'B1' : weighted < 4 ? 'B2' : 'C1'

  return (
    <div className="rounded-2xl bg-white text-gray-900 shadow-xl border border-gray-200 p-6">
      <div className="text-2xl font-semibold mb-4">Overall CEFR: {cefr}</div>
      <div className="grid grid-cols-5 gap-3 mt-2">
        {(['fluency','pronunciation','grammar','lexical','coherence'] as const).map((k) => (
          <div key={k} className="rounded-lg p-3 text-center bg-gray-50 border border-gray-200">
            <div className="text-sm capitalize">{k}</div>
            <div className="text-2xl font-bold">{Number((subs as any)[k] ?? 0).toFixed(1)}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="rounded-xl border border-gray-200 p-4 bg-gray-50">
          <div className="text-lg font-semibold mb-2">Writing — {writing.report.cefr}</div>
          <div className="text-sm mb-2">{writing.report.feedback}</div>
          <div className="text-sm text-gray-700">Key errors: {(writing.report.keyErrors || []).join(', ') || '—'}</div>
        </section>
        <section className="rounded-xl border border-gray-200 p-4 bg-gray-50">
          <div className="text-lg font-semibold mb-2">Speaking — {speaking.report.cefr}</div>
          <div className="text-sm mb-2">{speaking.report.feedback}</div>
          <div className="text-sm text-gray-700">Key errors: {(speaking.report.keyErrors || []).join(', ') || '—'}</div>
        </section>
      </div>
    </div>
  )
}


