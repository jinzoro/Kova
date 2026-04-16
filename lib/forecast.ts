/**
 * Holt-Winters double exponential smoothing (additive damped trend).
 * Used for short-term price projection.
 */

export interface ForecastPoint {
  step: number
  price: number
  pctChange: number
}

export interface ForecastResult {
  historical: number[]
  projections: ForecastPoint[]
  upper: number[]
  lower: number[]
}

/**
 * Holt-Winters additive double-exponential smoothing with damped trend.
 * @param prices   Array of closing prices (min ~20 values)
 * @param steps    Number of future steps to forecast (default 5)
 * @param alpha    Level smoothing (0 < α < 1)
 * @param beta     Trend smoothing (0 < β < 1)
 * @param phi      Damping factor (0 < φ ≤ 1)
 */
export function calcHoltWinters(
  prices: number[],
  steps = 5,
  alpha = 0.3,
  beta = 0.1,
  phi = 0.9,
): ForecastResult {
  if (prices.length < 4) {
    const last = prices[prices.length - 1] ?? 0
    return {
      historical: prices,
      projections: Array.from({ length: steps }, (_, i) => ({
        step: i + 1,
        price: last,
        pctChange: 0,
      })),
      upper: [],
      lower: [],
    }
  }

  // Initialise level and trend
  let level = prices[0]
  let trend = (prices[Math.min(4, prices.length - 1)] - prices[0]) / Math.min(4, prices.length - 1)

  const smoothed: number[] = [level]
  const residuals: number[] = [0]

  for (let i = 1; i < prices.length; i++) {
    const prevLevel = level
    const prevTrend = trend
    level = alpha * prices[i] + (1 - alpha) * (prevLevel + phi * prevTrend)
    trend = beta * (level - prevLevel) + (1 - beta) * phi * prevTrend
    smoothed.push(level)
    residuals.push(prices[i] - smoothed[i - 1])
  }

  // RMSE for confidence bands
  const mse =
    residuals.slice(-20).reduce((acc, r) => acc + r * r, 0) /
    Math.min(20, residuals.length)
  const rmse = Math.sqrt(mse)

  // Forecast
  const current = prices[prices.length - 1]
  const projections: ForecastPoint[] = []
  const upper: number[] = []
  const lower: number[] = []

  let forecastLevel = level
  let forecastTrend = trend

  for (let h = 1; h <= steps; h++) {
    // Damped trend: level + (phi + phi² + ... + phi^h) * trend
    let dampedSum = 0
    for (let j = 1; j <= h; j++) dampedSum += Math.pow(phi, j)
    const projection = forecastLevel + dampedSum * forecastTrend
    const band = rmse * Math.sqrt(h) * 1.96  // 95% CI

    projections.push({
      step: h,
      price: parseFloat(projection.toFixed(6)),
      pctChange: parseFloat((((projection - current) / current) * 100).toFixed(2)),
    })
    upper.push(projection + band)
    lower.push(projection - band)
  }

  return { historical: smoothed, projections, upper, lower }
}
