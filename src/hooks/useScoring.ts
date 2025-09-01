export type Subscores = {
  fluency: number
  pronunciation: number
  grammar: number
  lexical: number
  coherence: number
}

export type FinalReport = {
  cefr: 'A1' | 'A2' | 'B1' | 'B2' | 'C1'
  subscores: Subscores
  feedback: string
  keyErrors: string[]
  rephrases: string[]
}

type Analysis = {
  questionId: string
  transcript: string
  metrics: Partial<Subscores> & { keyErrors?: string[]; hints?: string[] }
  relevant?: boolean
  reply?: string | null
}

function clamp01(x: number): number { return Math.max(0, Math.min(5, x)) }

function mapToCEFR(avg: number): FinalReport['cefr'] {
  if (avg < 1) return 'A1'
  if (avg < 2) return 'A2'
  if (avg < 3) return 'B1'
  if (avg < 4) return 'B2'
  return 'C1'
}

export function useScoring() {
  const calculateScores = (transcript: string): Subscores => {
    const tokens = transcript.trim().split(/\s+/).filter(Boolean)
    const wordsPerMinute = Math.min(160, Math.max(40, tokens.length))
    const fluency = clamp01((wordsPerMinute - 40) / 24)
    const pronunciation = clamp01(3.0) // placeholder heuristic
    const grammar = clamp01(3.0)
    const lexical = clamp01(Math.min(5, (new Set(tokens.map(t => t.toLowerCase())).size / Math.max(1, tokens.length)) * 10))
    const coherence = clamp01(3.0)
    return { fluency, pronunciation, grammar, lexical, coherence }
  }

  const aggregate = (parts: Analysis[]): Subscores => {
    const acc: Subscores = { fluency: 0, pronunciation: 0, grammar: 0, lexical: 0, coherence: 0 }
    if (parts.length === 0) return acc
    for (const p of parts) {
      const m = (p.metrics || {}) as Record<string, unknown>
      // Перетворюємо можливі рядки у числа та ігноруємо NaN
      const f = Number((m.fluency as any) ?? 0)
      const pr = Number((m.pronunciation as any) ?? 0)
      const g = Number((m.grammar as any) ?? 0)
      const l = Number((m.lexical as any) ?? 0)
      const c = Number((m.coherence as any) ?? 0)
      acc.fluency += isFinite(f) ? f : 0
      acc.pronunciation += isFinite(pr) ? pr : 0
      acc.grammar += isFinite(g) ? g : 0
      acc.lexical += isFinite(l) ? l : 0
      acc.coherence += isFinite(c) ? c : 0
    }
    acc.fluency /= parts.length
    acc.pronunciation /= parts.length
    acc.grammar /= parts.length
    acc.lexical /= parts.length
    acc.coherence /= parts.length
    return acc
  }

  const finalize = (parts: Analysis[]): FinalReport => {
    let subscores = aggregate(parts)
    // Якщо з будь-якої причини оцінки нульові, спробуємо простий фолбек по транскриптах
    if (
      subscores.fluency === 0 &&
      subscores.pronunciation === 0 &&
      subscores.grammar === 0 &&
      subscores.lexical === 0 &&
      subscores.coherence === 0 &&
      parts.length > 0
    ) {
      const interim: Subscores = { fluency: 0, pronunciation: 0, grammar: 0, lexical: 0, coherence: 0 }
      for (const p of parts) {
        const s = calculateScores(p.transcript || '')
        interim.fluency += s.fluency
        interim.pronunciation += s.pronunciation
        interim.grammar += s.grammar
        interim.lexical += s.lexical
        interim.coherence += s.coherence
      }
      subscores = {
        fluency: interim.fluency / parts.length,
        pronunciation: interim.pronunciation / parts.length,
        grammar: interim.grammar / parts.length,
        lexical: interim.lexical / parts.length,
        coherence: interim.coherence / parts.length,
      }
    }
    const weightedAvg =
      subscores.fluency * 0.3 +
      subscores.grammar * 0.25 +
      subscores.lexical * 0.2 +
      subscores.pronunciation * 0.15 +
      subscores.coherence * 0.1
    const cefr = mapToCEFR(weightedAvg)
    const keyErrors = parts.flatMap(p => p.metrics.keyErrors ?? []).slice(0, 6)
    const feedback = `Середній рівень: ${weightedAvg.toFixed(2)}. Рекомендації: зверніть увагу на граматику та розширення словникового запасу.`
    const rephrases = [
      'I would like to highlight...',
      'One example that comes to mind is...',
      'From my experience, I learned that...',
    ]
    return { cefr, subscores, feedback, keyErrors, rephrases }
  }

  return { calculateScores, aggregate, finalize }
}