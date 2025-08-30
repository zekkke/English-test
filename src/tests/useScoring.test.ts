import { describe, it, expect } from 'vitest'
import { useScoring } from '../hooks/useScoring'

describe('useScoring', () => {
  it('calculates scores and finalizes report', () => {
    const { calculateScores, finalize } = useScoring()
    const subs = calculateScores('This is a sample response with decent length and variety in words.')
    expect(subs.fluency).toBeGreaterThanOrEqual(0)
    expect(subs.fluency).toBeLessThanOrEqual(5)
    const report = finalize([
      { questionId: '1', transcript: 'answer', metrics: subs },
      { questionId: '2', transcript: 'answer', metrics: subs },
    ])
    expect(['A1','A2','B1','B2','C1']).toContain(report.cefr)
    expect(report.subscores.fluency).toBeTypeOf('number')
  })
})



