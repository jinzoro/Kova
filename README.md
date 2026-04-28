# Kova — Crypto Intelligence Platform

A professional real-time cryptocurrency analytics dashboard with technical analysis, signal scoring, candlestick pattern detection, multi-timeframe consensus, and price forecasting. Built with Next.js 14, TypeScript, and Tailwind CSS.

---

## Table of Contents

- [Features](#features)
- [Setup & Installation](#setup--installation)
- [Environment Variables](#environment-variables)
- [Running the App](#running-the-app)
- [Deployment](#deployment)
- [Pages & Navigation](#pages--navigation)
- [Technical Indicators](#technical-indicators)
- [Candlestick Patterns](#candlestick-patterns)
- [Signal Scoring Engine](#signal-scoring-engine)
- [Multi-Timeframe Analysis](#multi-timeframe-analysis)
- [Holt-Winters Forecasting](#holt-winters-forecasting)
- [API Integrations](#api-integrations)
- [Tech Stack](#tech-stack)

---

## Features

- **Live BTC chart** on the dashboard with area/volume visualization
- **Top Gainers & Losers** updated every 30 seconds from Binance
- **Volume leaders** — most traded pairs by 24h USDT volume
- **Market sentiment** banner driven by Fear & Greed + market cap change
- **Watchlist** with 7-day sparklines (BTC, ETH, SOL, BNB, ADA)
- **Coin detail pages** with full technical analysis for any supported pair
- **8+ technical indicators** (EMA, RSI, MACD, Bollinger Bands, ATR, OBV, Stochastic RSI, Swing Levels)
- **10+ candlestick patterns** detected automatically
- **Signal scoring engine** — composite score from −10 to +10
- **Multi-timeframe consensus** — interactive selector across 15m, 30m, 1h, 4h, 1d, and 1w
- **Holt-Winters price forecast** — 5 candles ahead with 95% confidence bands
- **Support & resistance levels** — automatic swing pivot detection
- **Price alerts** with browser push notifications
- **Crypto news** aggregated from CryptoCompare
- **Fear & Greed Index** gauge
- **Funding rates** from Binance Futures
- No API key required for core features (Binance + CoinPaprika are free/public)

---

## Setup & Installation

### Prerequisites

- **Node.js 18+** (recommended: 20 LTS)
- **npm** or **yarn** or **pnpm**
- Git

### 1. Clone the repository

```bash
git clone https://github.com/your-username/kova.git
cd kova
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example env file and fill in your keys (all keys are optional — the app works without them using free public APIs):

```bash
cp .env.local.example .env.local
```

Then edit `.env.local` — see [Environment Variables](#environment-variables) for details.

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Environment Variables

All variables are **optional** — the app has graceful fallbacks.

| Variable | Required | Description |
|---|---|---|
| `NEWS_API_KEY` | No | CryptoCompare API key for the news feed. Without it, news may be rate-limited. Free key at [cryptocompare.com](https://www.cryptocompare.com/cryptopian/api-keys) |
| `CMC_API_KEY` | No | CoinMarketCap API key, used as a fallback data source for coins not in CoinPaprika. Free key at [coinmarketcap.com/api](https://coinmarketcap.com/api/) |
| `NEXT_PUBLIC_APP_URL` | No | Base URL for the app. Defaults to `http://localhost:3000` in development |

**Example `.env.local`:**

```env
NEWS_API_KEY=your_cryptocompare_api_key_here
CMC_API_KEY=your_cmc_api_key_here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **Security note:** `NEWS_API_KEY` and `CMC_API_KEY` are server-side only variables. They are never exposed to the browser. Only variables prefixed with `NEXT_PUBLIC_` are sent to the client.

---

## Running the App

```bash
# Development (hot reload)
npm run dev

# Production build
npm run build
npm start

# Lint
npm run lint

# Tests
npm test
```

---

## Deployment

Kova is configured for zero-config deployment on **Vercel**.

### Deploy to Vercel

1. Push the repo to GitHub
2. Import the project at [vercel.com/new](https://vercel.com/new)
3. Add your environment variables in the Vercel dashboard (Settings → Environment Variables)
4. Click **Deploy**

All API routes use Next.js Edge/Node runtimes and deploy automatically. No separate backend needed.

---

## Pages & Navigation

| Route | Description |
|---|---|
| `/` | Market overview dashboard — live BTC chart, gainers/losers, watchlist |
| `/coin/[symbol]` | Full technical analysis for any coin (e.g. `/coin/btc`, `/coin/eth`, `/coin/sol`) |
| `/screener` | Signal screener — filterable table of the top coins by Binance volume with signal scores, RSI, and pattern detection |
| `/alerts` | Create and manage price alerts with browser notifications |
| `/news` | Aggregated crypto news filtered by BTC, ETH, DeFi categories |

---

## Signal Screener

Located at `/screener`. A real-time table of the top coins by 24h USDT volume on Binance, scored with the same signal engine used on coin detail pages.

### Columns

| Column | Description |
|---|---|
| **Coin** | Base symbol (e.g. BTC, ETH, SOL) |
| **Price** | Last trade price in USD |
| **24h** | 24-hour price change % |
| **Volume** | 24h USDT trading volume |
| **RSI** | Current RSI(14) from 1h klines — colored green (<30), red (>70) |
| **Signal** | Composite score −10 to +10 from the scoring engine |
| **Pattern** | Most recent candlestick pattern detected in the last 5 candles |

### Filters

- **Signal score range** — slider from −10 to +10; quick presets: Strong Buy (≥+6), Buy Zone (≥+2), Oversold (≤−4)
- **Pattern type** — All / Bullish / Bearish
- **Sort** — click any column header to sort ascending or descending

### Data & Refresh

- Scores computed server-side from 1h Binance klines (200 candles per coin)
- Stablecoins (USDC, DAI, RLUSD, etc.) and leveraged tokens are excluded automatically
- Route cached for 5 minutes (`revalidate = 300`); client polls every 5 minutes
- A partial-results banner appears if some coins failed to fetch (e.g. Binance rate limiting on cloud IPs)

---

## Technical Indicators

All indicators are implemented in pure TypeScript at `lib/indicators.ts` and run client-side on OHLCV data fetched from Binance.

---

### EMA — Exponential Moving Average

**What it is:** A weighted moving average that gives more importance to recent prices, making it more responsive to new information than a simple moving average (SMA).

**How it works:**
```
EMA(today) = Price(today) × k + EMA(yesterday) × (1 − k)
where k = 2 / (period + 1)
```
The first EMA value is seeded with the SMA of the first `period` candles.

**Periods used:** 12, 26, 50, 200

**Strategy applications:**

| Setup | Signal | Description |
|---|---|---|
| **EMA 12 crosses above EMA 26** | Bullish | Short-term momentum turning positive. Classic entry trigger |
| **EMA 12 crosses below EMA 26** | Bearish | Short-term momentum turning negative. Classic exit/short trigger |
| **Price above EMA 200** | Bullish bias | Long-term uptrend confirmed. Favor long setups only |
| **Price below EMA 200** | Bearish bias | Long-term downtrend. Avoid longs; look for short setups |
| **EMA 12 > EMA 26 > EMA 50 > EMA 200** | Strong uptrend | Full "bull stack" — all timeframes aligned bullish |
| **EMA 12 < EMA 26 < EMA 50 < EMA 200** | Strong downtrend | Full "bear stack" — all timeframes aligned bearish |

**On the chart:** EMA 12 = orange, EMA 26 = blue, EMA 200 = pink (toggle in overlay controls)

---

### RSI — Relative Strength Index

**What it is:** A momentum oscillator that measures the speed and magnitude of price changes. Ranges from 0 to 100.

**How it works:**
```
RSI = 100 − (100 / (1 + RS))
where RS = Average Gain / Average Loss over N periods (default: 14)
```
Uses Wilder's smoothing method (not simple average) for accuracy.

**Key levels:**
- **< 30**: Oversold — price may have fallen too far, potential reversal up
- **30–40**: Recovering from oversold
- **40–60**: Neutral momentum
- **60–70**: Strong momentum, approaching overbought
- **> 70**: Overbought — price may have risen too far, potential reversal down

**Strategy applications:**

| Setup | Signal |
|---|---|
| RSI < 30 on daily timeframe | High-probability long entry zone |
| RSI > 70 on daily timeframe | High-probability take-profit / short zone |
| RSI bullish divergence (price lower low, RSI higher low) | Reversal signal — strong long setup |
| RSI bearish divergence (price higher high, RSI lower high) | Reversal signal — strong short/exit setup |
| RSI crossing above 50 | Momentum shift bullish |
| RSI crossing below 50 | Momentum shift bearish |

**Tip:** RSI is most reliable on the 4h and daily timeframes. On 1m/5m it generates many false signals.

---

### MACD — Moving Average Convergence Divergence

**What it is:** A trend-following momentum indicator that shows the relationship between two EMAs. Consists of three components: the MACD line, the signal line, and the histogram.

**How it works:**
```
MACD Line   = EMA(12) − EMA(26)
Signal Line = EMA(9) of MACD Line
Histogram   = MACD Line − Signal Line
```

**Reading the MACD:**
- **Histogram above zero & growing**: Strong bullish momentum accelerating
- **Histogram above zero & shrinking**: Bullish but momentum slowing
- **Histogram below zero & shrinking (toward zero)**: Bearish momentum weakening
- **Histogram below zero & growing (away from zero)**: Bearish momentum accelerating
- **MACD line crosses above signal line**: Bullish crossover — entry signal
- **MACD line crosses below signal line**: Bearish crossover — exit/short signal

**Strategy applications:**

| Setup | Signal |
|---|---|
| MACD bullish crossover + histogram positive | Buy signal — combine with RSI < 60 for confluence |
| MACD bearish crossover + histogram negative | Sell signal |
| MACD bullish divergence | Potential reversal up |
| MACD histogram acceleration (bars growing) | Trend strengthening |
| MACD histogram deceleration (bars shrinking) | Trend weakening — tighten stops |

**On the chart:** MACD histogram + signal line rendered on a separate sub-chart below the main candles.

---

### Bollinger Bands

**What it is:** A volatility indicator consisting of a middle band (SMA) and two outer bands placed 2 standard deviations above and below.

**How it works:**
```
Middle Band = 20-period SMA
Upper Band  = Middle + (2 × Standard Deviation)
Lower Band  = Middle − (2 × Standard Deviation)
```

**Reading Bollinger Bands:**
- When bands **widen**: Volatility is expanding (often follows a breakout)
- When bands **narrow (squeeze)**: Volatility is contracting — a big move is coming
- Price at the **lower band**: Oversold in current volatility context
- Price at the **upper band**: Overbought in current volatility context
- Price **walking the upper band**: Strong uptrend
- Price **walking the lower band**: Strong downtrend

**Strategy applications:**

| Setup | Signal |
|---|---|
| Band squeeze (width < 20-period average) | Anticipate breakout — direction unclear until it happens |
| Price bounces off lower band with RSI < 40 | Mean-reversion long setup |
| Price bounces off upper band with RSI > 60 | Mean-reversion short / take-profit |
| Price closes outside upper band | Overbought / breakout — high risk zone |
| Price closes outside lower band | Oversold / breakdown — potential panic bottom |

**On the chart:** Toggle "BB" in overlay controls to show upper, middle, and lower bands.

---

### ATR — Average True Range

**What it is:** A volatility measure that captures the average daily price range, including gaps. Does not indicate direction — only magnitude of movement.

**How it works:**
```
True Range = max(High − Low, |High − PrevClose|, |Low − PrevClose|)
ATR = Wilder's smoothing of True Range over 14 periods
```

**Strategy applications:**

| Use Case | How |
|---|---|
| **Stop loss placement** | Set stop at 1.5–2× ATR below entry (long) or above entry (short) |
| **Position sizing** | Risk 1% of account ÷ (1.5 × ATR) = position size in units |
| **Volatility filter** | If ATR is very low, avoid breakout trades (false moves more likely) |
| **Profit targets** | Set TP at 2–3× ATR from entry |

**Displayed in:** Technical Analysis Summary → Volatility section on coin detail pages.

---

### OBV — On-Balance Volume

**What it is:** A cumulative volume indicator that adds volume on up days and subtracts volume on down days. Tracks whether volume is flowing into or out of an asset.

**How it works:**
```
If close > prev close: OBV = prev OBV + volume
If close < prev close: OBV = prev OBV − volume
If close = prev close: OBV = prev OBV
```

**Reading OBV:**
- **OBV rising**: Buyers are more aggressive — accumulation
- **OBV falling**: Sellers are more aggressive — distribution
- **OBV divergence (price rising but OBV falling)**: Weak rally — smart money distributing. Bearish warning
- **OBV divergence (price falling but OBV rising)**: Weak selloff — smart money accumulating. Bullish signal

**Strategy applications:**

| Setup | Signal |
|---|---|
| OBV making new highs with price | Trend confirmation — continue long |
| OBV diverging from price (negative divergence) | Reduce position / prepare to exit |
| OBV diverging from price (positive divergence) | Potential bottom — watch for reversal |

---

### Stochastic RSI

**What it is:** An oscillator of an oscillator — applies the Stochastic formula to RSI values instead of price. More sensitive than regular RSI, better for identifying short-term turning points.

**How it works:**
```
StochRSI = (RSI − Lowest RSI over N) / (Highest RSI over N − Lowest RSI over N)
K = 3-period SMA of StochRSI
D = 3-period SMA of K
```
Default: RSI period 14, StochRSI period 14, smooth 3.

**Key levels:** Same as Stochastic:
- **K/D < 20**: Oversold
- **K/D > 80**: Overbought
- **K crosses above D below 20**: Buy signal
- **K crosses below D above 80**: Sell signal

**Strategy applications:** Best used on lower timeframes (1h, 4h) to time entries when the daily trend is already confirmed bullish/bearish.

---

### Swing Level Detection (Support & Resistance)

**What it is:** Automatically identifies pivot highs and lows from price action to determine key support and resistance levels.

**How it works:** Scans klines for local maxima (pivot highs) and minima (pivot lows) using a 5-candle window. The most recent unfilled pivot levels become the active support/resistance.

**Reading S/R levels:**
- **Support**: A price level where buying has historically been strong enough to halt a decline. The more times a level holds, the stronger it is
- **Resistance**: A price level where selling has historically been strong enough to halt a rally
- **Flip**: When a resistance level is broken, it often becomes support (and vice versa)

**Strategy applications:**

| Setup | Action |
|---|---|
| Price approaching major support | Consider long entry with tight stop below support |
| Price at resistance with bearish signal | Consider taking profit or shorting with stop above resistance |
| Support break | Exit longs, potential short entry |
| Resistance break (bullish) | Add to longs, trail stop up to broken resistance |

**Displayed in:** Support/Resistance panel on coin detail pages.

---

## Candlestick Patterns

Detected automatically at `lib/patterns.ts` and displayed in the Technical Analysis Summary section.

---

### Single-Candle Patterns

#### Doji (Neutral)
**Appearance:** Open ≈ Close (body < 10% of total range). Long wicks on both sides.  
**Meaning:** Indecision — buyers and sellers are balanced. After a trend, signals potential reversal. Needs confirmation from the next candle.

#### Hammer (Bullish)
**Appearance:** Small body at the top of the range, lower wick ≥ 2× the body length, little or no upper wick.  
**Meaning:** Appeared at the bottom of a downtrend. Sellers pushed price down but buyers pushed it back up — bullish reversal signal.  
**Strategy:** Long entry on next candle close above the hammer's high, stop below the wick.

#### Shooting Star (Bearish)
**Appearance:** Small body at the bottom of the range, upper wick ≥ 2× the body length, little or no lower wick.  
**Meaning:** Appeared at the top of an uptrend. Buyers pushed price up but sellers pushed it back down — bearish reversal signal.  
**Strategy:** Short entry / exit longs on next candle close below shooting star low.

#### Hanging Man (Bearish)
**Appearance:** Same shape as a Hammer but appears at the top of an uptrend.  
**Meaning:** Bearish warning — despite buyers recovering price, the long lower wick shows sellers becoming active.

#### Inverted Hammer (Bullish)
**Appearance:** Same shape as a Shooting Star but appears at the bottom of a downtrend.  
**Meaning:** Bullish warning — despite sellers recovering price, the long upper wick shows buyers becoming active.

#### Marubozu (Strong Directional)
**Appearance:** Body covers > 85% of the total range. Little to no wicks.  
**Meaning:** Decisive candle. Bullish Marubozu = buyers in full control. Bearish Marubozu = sellers in full control. Strong continuation signal.

#### Spinning Top (Neutral)
**Appearance:** Small body (< 30% of range) with significant wicks on both sides.  
**Meaning:** Indecision. Neither buyers nor sellers are in control. In a trend, signals potential exhaustion.

---

### Multi-Candle Patterns

#### Bullish Engulfing (Bullish Reversal)
**Appearance:** A bearish candle followed by a larger bullish candle whose body fully covers the previous bearish body.  
**Meaning:** Strong reversal — buyers overwhelmed sellers in a single candle.  
**Strategy:** Enter long at close of bullish candle, stop below engulfing candle's low.

#### Bearish Engulfing (Bearish Reversal)
**Appearance:** A bullish candle followed by a larger bearish candle whose body fully covers the previous bullish body.  
**Meaning:** Strong reversal — sellers overwhelmed buyers. Exit longs / enter short.

#### Bullish Harami (Bullish Reversal)
**Appearance:** Large bearish candle followed by a small bullish candle contained within the previous body.  
**Meaning:** Selling momentum slowing. Weaker signal than Engulfing — needs confirmation.

#### Bearish Harami (Bearish Reversal)
**Appearance:** Large bullish candle followed by a small bearish candle contained within the previous body.  
**Meaning:** Buying momentum slowing. Weaker signal — needs confirmation.

#### Morning Star (Bullish Reversal — Strong)
**Appearance:** 3-candle pattern: Large bearish → Small body (gap down) → Large bullish closing above midpoint of first candle.  
**Meaning:** High-probability bottoming pattern. The middle candle (star) represents indecision at the lows.  
**Strategy:** Enter long after the third candle confirms, stop below the star's low.

#### Evening Star (Bearish Reversal — Strong)
**Appearance:** 3-candle pattern: Large bullish → Small body (gap up) → Large bearish closing below midpoint of first candle.  
**Meaning:** High-probability topping pattern.  
**Strategy:** Exit longs / enter short after third candle confirms.

#### Three White Soldiers (Strong Bullish Continuation)
**Appearance:** Three consecutive strong bullish candles, each opening within the previous body and closing near its high.  
**Meaning:** Sustained buying pressure. Confirms uptrend continuation.  
**Strategy:** Momentum trade — add to longs. Be careful if this appears after a large extended rally (exhaustion risk).

#### Three Black Crows (Strong Bearish Continuation)
**Appearance:** Three consecutive strong bearish candles, each opening within the previous body and closing near its low.  
**Meaning:** Sustained selling pressure. Confirms downtrend continuation.  
**Strategy:** Hold/add shorts. Avoid catching falling knife longs.

---

### Trend Phase Analysis

The app identifies the current market phase from EMA alignment and price action:

| Phase | Conditions | Strategy |
|---|---|---|
| **Strong Uptrend** | EMA 12 > EMA 26 > EMA 200, price above all EMAs | Favor longs, buy pullbacks to EMA 26 |
| **Uptrend** | EMA 12 > EMA 26 > EMA 200, with some divergence | Long bias, tighter stops |
| **Sideways / Consolidation** | EMAs converging, price chopping between levels | Reduce position size; trade range extremes only |
| **Downtrend** | EMA 12 < EMA 26, price below EMA 200 | Short bias, sell rallies to EMA 26 |
| **Strong Downtrend** | Full bear stack below EMA 200 | Avoid longs, shorts only or cash |

---

## Signal Scoring Engine

Located at `lib/scoring.ts`. Calculates a composite signal score from −10 to +10 by combining multiple indicators.

### Score Breakdown

| Indicator | Max Bullish | Max Bearish | Logic |
|---|---|---|---|
| **EMA 12/26 crossover** | +2 | −2 | Crossover = ±2; EMA12 above/below EMA26 = ±1 |
| **EMA 200 trend filter** | +2 | −2 | Price above EMA200 = +2, below = −2 |
| **RSI (14)** | +2 | −2 | < 30 oversold = +2; > 70 overbought = −2; graduated between |
| **MACD histogram** | +2 | −2 | Positive & accelerating = +2; negative & accelerating = −2 |
| **Bollinger Bands** | +1 | −1 | At/below lower = +1; at/above upper = −1; above/below midline = ±1 |
| **OBV trend** | +1 | −1 | Rising OBV = +1; falling OBV = −1 |
| **Total** | **+10** | **−10** | |

### Signal Labels

| Score | Label | Interpretation |
|---|---|---|
| ≥ +6 | **Strong Buy** | Multiple indicators aligned bullish — high confidence long setup |
| +2 to +5 | **Buy** | More bullish than bearish signals — moderate long bias |
| −1 to +1 | **Neutral** | Conflicting signals — no directional edge |
| −5 to −2 | **Sell** | More bearish signals — moderate short / exit bias |
| ≤ −6 | **Strong Sell** | Multiple indicators aligned bearish — high confidence short setup |

### How to use the Signal Score

The score is a **decision support tool**, not a mechanical trading system.

- Use **Strong Buy** signals (≥ +6) as confirmation for setups you've already identified from chart analysis
- **Never trade the score in isolation** — always check the market phase, support/resistance, and volume
- A **Strong Buy** in a **Strong Downtrend** (below EMA 200) is less reliable than in an uptrend
- Combine with multi-timeframe consensus (see below) for higher-conviction entries

---

## Multi-Timeframe Analysis

The app calculates signal scores across multiple timeframes and combines them into a weighted consensus. You can toggle which timeframes to include directly on the coin detail page — the consensus updates instantly.

### Available Timeframes

| Timeframe | Weight | Candles Fetched | Category | Best For |
|---|---|---|---|---|
| 15m | ×1 | 200 (~2 days) | Short-term | Scalping context, intraday timing |
| 30m | ×2 | 200 (~4 days) | Short-term | Intraday swing context |
| 1h | ×3 | 200 (~8 days) | Short-term | Short-swing entries and exits |
| 4h | ×4 | 200 (~33 days) | Midterm | Swing trade direction |
| 6h | ×5 | 200 (~50 days) | Midterm | Broader intraday trend |
| 12h | ×6 | 200 (~100 days) | Midterm | Half-day momentum, swing confirmation |
| 1d | ×7 | 200 (~6.5 months) | Midterm/Long | Primary trend direction |
| 3d | ×8 | 150 (~15 months) | Long-term | Multi-day swing structure |
| 1w | ×9 | 100 (~1.9 years) | Long-term | Macro bias and long-term structure |
| 1M | ×10 | 60 (~5 years) | Long-term | Monthly macro cycle, position trading |

Higher weights mean the timeframe carries more influence on the consensus score — monthly and weekly signals outweigh intraday noise.

### Default Selection

The panel defaults to **1h, 4h, and 1d** — a balanced starting point for swing trading. Toggle any combination using the pill buttons at the top of the panel.

**Example combinations:**
- Short-term: `15m + 30m + 1h`
- Swing trading: `1h + 4h + 1d` *(default)*
- Midterm: `4h + 12h + 1d + 3d`
- Long-term macro: `1d + 1w + 1M`
- Full spectrum: select all 10

> Minimum 2 timeframes required. All timeframe data is prefetched in the background so switching combinations is instant.

### Consensus Levels

| Agreement | Description |
|---|---|
| **Strong Agreement** | All selected timeframes point the same direction |
| **Agreement** | All timeframes bullish or all bearish (but not identical labels) |
| **Mixed** | Timeframes diverge but the weighted score is above ±2 |
| **Disagreement** | Timeframes in direct conflict — high uncertainty |

### How to use MTF Consensus

1. **Only trade in the direction of Strong Agreement** — all selected timeframes must agree
2. **Use short timeframes (15m/30m) for timing entries** once the higher timeframes confirm direction
3. **Mixed signals** = stay flat or wait — the market hasn't made up its mind
4. **Add 1w** for a macro sanity check — a 1d bullish signal in a multi-year bear market carries less weight
5. **Disagreement** often appears at major turning points — watch for reversal patterns

---

## Holt-Winters Forecasting

Located at `lib/forecast.ts`. Provides a 5-candle price projection using Holt-Winters double exponential smoothing.

### Algorithm

Holt-Winters (additive, damped trend) is a time-series forecasting method that models both the **level** and **trend** of the price series.

**Parameters:**
| Parameter | Symbol | Value | Role |
|---|---|---|---|
| Level smoothing | α (alpha) | 0.3 | How quickly the model adapts to price changes |
| Trend smoothing | β (beta) | 0.1 | How quickly the model adapts to trend changes |
| Damping factor | φ (phi) | 0.9 | Reduces trend impact over time (prevents over-extrapolation) |

**Output:**
- **Point forecasts**: 5 future price levels
- **Confidence bands**: 95% interval based on in-sample RMSE
- **% change**: Expected move from current price to each forecast step

### How to interpret the forecast

- The forecast shows where price **statistically tends to go** given the current momentum
- Wide confidence bands = high uncertainty (volatile conditions)
- Narrow confidence bands = lower uncertainty (trending conditions)
- **This is NOT a price prediction** — it is a probabilistic range based on historical momentum
- Use it as context for your trade: if the forecast shows upside and you're long, you have a tailwind

---

## API Integrations

### Binance (Primary Chart & Price Data)
- **No API key required**
- OHLCV klines: all intervals from 1m to 1w
- 24h tickers for price, volume, change
- Funding rates from Binance Futures
- Rate limit: 1200 requests/minute (generous for a single user)

### CoinPaprika (Market Data)
- **No API key required**
- Coin market caps, prices, rankings
- Coin metadata and descriptions
- Search functionality
- Free tier: 25,000 calls/month per IP

### Alternative.me (Fear & Greed Index)
- **No API key required**
- Historical and current index data
- Updates once per day

### CryptoCompare (News)
- Free tier works without a key (rate limited)
- Add `NEWS_API_KEY` in `.env.local` for higher limits
- Categories: BTC, ETH, DEFI, and more

### CoinMarketCap (Optional Fallback)
- Used only when CoinPaprika doesn't have a coin
- Requires `CMC_API_KEY` in `.env.local`
- Proxied through `/api/cmc/quote` to keep the key server-side

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 3 |
| Charts | TradingView Lightweight Charts 4 |
| Data Fetching | TanStack React Query 5 |
| Notifications | react-hot-toast |
| Deployment | Vercel |
| Testing | Jest + ts-jest |

---

## Project Structure

```
kova/
├── app/
│   ├── page.tsx                    # Home dashboard (server shell)
│   ├── dashboard-client.tsx        # Home dashboard (client, interactive)
│   ├── layout.tsx                  # Root layout + Navbar
│   ├── providers.tsx               # React Query + toast providers
│   ├── globals.css                 # Global styles, design tokens
│   ├── coin/[symbol]/              # Coin detail pages
│   ├── screener/                   # Signal screener (filterable table)
│   ├── alerts/                     # Price alerts
│   ├── news/                       # News feed
│   └── api/
│       ├── screener/route.ts       # Top coins screener with kline-based signals
│       ├── top-movers/route.ts     # Top gainers/losers from Binance
│       ├── cmc/quote/route.ts      # CoinMarketCap proxy
│       └── news/route.ts           # CryptoCompare news proxy
├── components/
│   ├── charts/
│   │   ├── CandlestickChart.tsx    # Full OHLCV chart with overlays
│   │   ├── BtcMiniChart.tsx        # Compact area chart for dashboard
│   │   ├── RSIChart.tsx            # RSI oscillator sub-chart
│   │   ├── MACDChart.tsx           # MACD histogram sub-chart
│   │   └── ForecastChart.tsx       # Holt-Winters forecast visualization
│   ├── layout/
│   │   └── Navbar.tsx
│   └── ui/
│       ├── SignalScoreCard.tsx      # Composite score display
│       ├── TechnicalSummary.tsx    # Full indicator dashboard
│       ├── SupportResistance.tsx   # S/R level visualization
│       ├── VolumeSpike.tsx         # Volume analysis
│       ├── FundingRate.tsx         # Futures funding rate
│       ├── FearGreedGauge.tsx      # Fear & Greed gauge
│       ├── CoinCard.tsx            # Watchlist coin card
│       ├── SearchBar.tsx           # Coin search
│       └── CoinLogo.tsx            # Coin logo
├── hooks/
│   ├── useCoinData.ts              # Market data queries
│   ├── useKlines.ts                # OHLCV kline queries
│   ├── useTopMovers.ts             # Top gainers/losers queries
│   ├── useFundingRate.ts           # Futures funding rate queries
│   └── useAlerts.ts                # Alert state management
├── lib/
│   ├── indicators.ts               # All technical indicators
│   ├── patterns.ts                 # Candlestick pattern detection
│   ├── scoring.ts                  # Signal scoring engine
│   ├── forecast.ts                 # Holt-Winters forecasting
│   ├── binance.ts                  # Binance API client
│   └── coingecko.ts                # CoinPaprika/CoinGecko client
├── __tests__/                      # Jest unit tests
├── .env.local.example              # Environment variable template
├── next.config.mjs
├── tailwind.config.ts
└── package.json
```

---

## License

MIT
