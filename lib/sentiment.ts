/** Keyword-based sentiment scorer for crypto news headlines. */

const BULLISH_WORDS = [
  'surge', 'surges', 'surged', 'rally', 'rallies', 'rallied', 'soar', 'soars', 'soared',
  'gain', 'gains', 'gained', 'rise', 'rises', 'rose', 'risen', 'jump', 'jumps', 'jumped',
  'bullish', 'breakout', 'all-time high', 'ath', 'record', 'milestone', 'adoption',
  'approval', 'approved', 'launch', 'upgrade', 'partnership', 'integration', 'buy',
  'accumulate', 'inflow', 'inflows', 'institutional', 'growth', 'bullrun', 'moon',
  'recover', 'recovery', 'rebound', 'boost', 'outperform', 'strong', 'positive',
]

const BEARISH_WORDS = [
  'crash', 'crashes', 'crashed', 'drop', 'drops', 'dropped', 'fall', 'falls', 'fell',
  'plunge', 'plunges', 'plunged', 'dump', 'dumps', 'dumped', 'decline', 'declines',
  'bearish', 'breakdown', 'selloff', 'sell-off', 'ban', 'banned', 'hack', 'hacked',
  'exploit', 'vulnerability', 'fraud', 'scam', 'ponzi', 'rug', 'liquidation',
  'outflow', 'outflows', 'fear', 'panic', 'concern', 'warning', 'risk', 'lawsuit',
  'regulation', 'crackdown', 'restrict', 'lose', 'loss', 'losses', 'weak', 'negative',
]

export interface SentimentScore {
  score: number       // -1.0 to +1.0
  label: 'Bullish' | 'Bearish' | 'Neutral'
  bullishHits: number
  bearishHits: number
}

export function scoreSentiment(text: string): SentimentScore {
  const lower = text.toLowerCase()
  let bullishHits = 0
  let bearishHits = 0

  for (const word of BULLISH_WORDS) {
    if (lower.includes(word)) bullishHits++
  }
  for (const word of BEARISH_WORDS) {
    if (lower.includes(word)) bearishHits++
  }

  const total = bullishHits + bearishHits
  const score = total === 0 ? 0 : (bullishHits - bearishHits) / total
  const label = score > 0.1 ? 'Bullish' : score < -0.1 ? 'Bearish' : 'Neutral'

  return { score, label, bullishHits, bearishHits }
}
