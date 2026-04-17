/** Pearson correlation and return-series utilities. */

export function calcReturns(prices: number[]): number[] {
  const out: number[] = []
  for (let i = 1; i < prices.length; i++) {
    out.push((prices[i] - prices[i - 1]) / (prices[i - 1] || 1))
  }
  return out
}

export function calcPearsonCorrelation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  if (n < 2) return NaN

  const ax = a.slice(-n), bx = b.slice(-n)
  const meanA = ax.reduce((s, v) => s + v, 0) / n
  const meanB = bx.reduce((s, v) => s + v, 0) / n

  let num = 0, denomA = 0, denomB = 0
  for (let i = 0; i < n; i++) {
    const da = ax[i] - meanA
    const db = bx[i] - meanB
    num += da * db
    denomA += da * da
    denomB += db * db
  }

  const denom = Math.sqrt(denomA * denomB)
  return denom === 0 ? 0 : num / denom
}

export function calcCorrelationMatrix(
  series: Record<string, number[]>,
): Record<string, Record<string, number>> {
  const symbols = Object.keys(series)
  const returns: Record<string, number[]> = {}
  for (const sym of symbols) returns[sym] = calcReturns(series[sym])

  const matrix: Record<string, Record<string, number>> = {}
  for (const a of symbols) {
    matrix[a] = {}
    for (const b of symbols) {
      matrix[a][b] = a === b ? 1 : calcPearsonCorrelation(returns[a], returns[b])
    }
  }
  return matrix
}
