import { calcHoltWinters } from '../lib/forecast'

describe('calcHoltWinters', () => {
  const linearUp = Array.from({ length: 50 }, (_, i) => 100 + i * 2)

  it('returns `steps` projections', () => {
    const result = calcHoltWinters(linearUp, 5)
    expect(result.projections).toHaveLength(5)
  })

  it('projects upward for uptrend (last projection positive)', () => {
    const result = calcHoltWinters(linearUp, 5)
    const last = result.projections[result.projections.length - 1]
    expect(last.pctChange).toBeGreaterThan(0)
  })

  it('upper band >= projected >= lower band', () => {
    const result = calcHoltWinters(linearUp, 5)
    result.projections.forEach((p, i) => {
      expect(result.upper[i]).toBeGreaterThanOrEqual(p.price - 0.0001)
      expect(p.price).toBeGreaterThanOrEqual(result.lower[i] - 0.0001)
    })
  })

  it('handles very short input gracefully', () => {
    const result = calcHoltWinters([100, 101], 5)
    expect(result.projections).toHaveLength(5)
  })

  it('step numbers are 1..N', () => {
    const result = calcHoltWinters(linearUp, 5)
    result.projections.forEach((p, i) => expect(p.step).toBe(i + 1))
  })
})
