# Changelog

All notable changes to Kova are documented here.

---

## [0.2.0] — 2026-04-17

### New Indicators
- **Squeeze Momentum (Lazybear)** — detects Bollinger Band compression inside Keltner Channels; fires a directional signal when the squeeze releases. Shown in Technical Analysis with ON/OFF/FIRED badge and momentum value.
- **Ichimoku Cloud** — full Tenkan-sen (9), Kijun-sen (26), Senkou Span A/B, and Chikou Span. Displays TK cross status, price vs cloud position (above/below/inside), and cloud color (green = bullish, red = bearish).
- **CVD (Cumulative Volume Delta)** — estimates buy vs sell pressure from OHLCV data. Renders a histogram of per-candle deltas and a cumulative CVD line in the Volume & Structure section.

### New Pattern Analysis
- **Wyckoff Phase Detection** — classifies market structure into Accumulation, Markup, Distribution, or Markdown phases using OBV trend, ATR expansion/contraction, and price position within the lookback range. Shown with High/Medium/Low confidence badge.

### New Pages
- **Signal Screener (`/screener`)** — filterable table of the top 25 coins by Binance volume. Columns: price, 24h change, volume, RSI, signal score, and latest candlestick pattern. Supports score range sliders, pattern type filter, quick presets (Strong Buy, Buy Zone, Oversold), and sortable columns. Refreshes every 5 minutes via a server-side API route.

### New Components
- **FuturesPanel** — shows Open Interest and Funding Rate side by side with interpretation (Overheated / Short-heavy / Neutral). Added to the Volume & Structure section on every coin detail page.
- **CorrelationMatrix** — 6×6 Pearson correlation matrix (BTC, ETH, SOL, BNB, XRP, ADA) computed from 30-day daily returns. Color-coded from negative (red) to high positive (green). Added to the dashboard below the heatmap.

### Improvements
- **Sparklines on CoinCards** — watchlist cards on the dashboard now display a 7-day price sparkline fetched from Binance 1d klines via the new `useSparklines` hook.
- **Alert shortcut on coin detail** — a 🔔 Alert button in the coin header opens an inline popover to set a price target without leaving the page. Fires a toast on confirmation and links to the full Alerts page.
- **News sentiment badges** — every article on the News page now shows a Bullish or Bearish badge computed from keyword scoring of the headline and body (`lib/sentiment.ts`).
- **Real ETH dominance** — `fetchGlobal` now fetches ETH's market cap from CoinPaprika and calculates the real ETH dominance percentage instead of hardcoding 0.
- **Real 24h High/Low on coin detail** — `fetchCoinDetail` now fetches the Binance 24h ticker in parallel and uses its `highPrice`/`lowPrice` instead of the ±1% price approximation.
- **Supply data from ticker** — `circulating_supply`, `total_supply`, and `max_supply` are now populated from CoinPaprika ticker fields instead of defaulting to 0/null.
- **S/R strength counts real touches** — `getNearestSRLevels` now counts how many swing points fall within a 1% zone of each level instead of hardcoding strength = 1.

### New Library Files
- `lib/correlation.ts` — Pearson correlation and daily return utilities
- `lib/sentiment.ts` — keyword-based bullish/bearish news scorer

### New Hooks
- `useOpenInterest` — polls Binance Futures `/openInterest` endpoint every 60s
- `useSparklines` — fetches 7 × 1d close prices for multiple symbols (1h refresh)

### Navigation
- Screener added to the navbar and the dashboard Quick Analyze section.

---

## [0.1.0] — 2026-04-16

### New Features
- **Live WebSocket price streaming** — `useStreamPrices` opens a single Binance `@miniTicker` WebSocket connection for all dashboard symbols. Prices flash green/red on each tick.
- **Live WebSocket kline streaming** — `useStreamKlines` combines a REST kline baseline with a `@kline_{interval}` WebSocket overlay. The last candle updates in real time; a new candle is appended when the current one closes.
- **Market Heatmap** — treemap of the top 40 coins sized by 24h USDT volume and colored by 24h price change. Built with a pure SVG layout (no external library).
- **BTC Mini Chart** — live 1h candlestick chart on the dashboard using TradingView Lightweight Charts, overlaid with the WebSocket price feed.
- **Top Movers panel** — top gainers and losers by 24h % change, sourced from the `/api/top-movers` route which filters Binance 24h tickers to USDT pairs above $10M volume.
- **Multi-Timeframe Analysis (MTF)** — fetches 1h, 4h, and 1d klines independently, scores each with `scoreSignal`, then combines them with a weighted consensus (1d×3, 4h×2, 1h×1). Agreement level shown as Strong Agreement / Agreement / Mixed / Disagreement.
- **Extended Technical Analysis panel** (`TechnicalSummary`) — ADX + ±DI directional index, Stochastic RSI (%K/%D), OBV volume pressure, Williams %R, Fibonacci retracement levels (7 ratios), classic Pivot Points (PP, R1–R3, S1–S3), RSI divergence detection, and an auto-generated narrative interpretation summary.
- **Interval selector on price chart** — switch between 1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w directly on the candlestick chart. RSI and MACD charts update to match.
- **Volume Leaders** — top 10 coins by 24h USDT volume shown as pill badges on the dashboard.

### Improvements
- Navbar, SearchBar, and mobile menu implemented.
- `CoinCard` updated with live price flash and 7-day sparkline support.
- Candlestick chart upgraded with EMA 12/26/50/200 overlays, Bollinger Bands, and VWAP toggle.
- RSI chart and MACD chart extracted into standalone resizable components with overbought/oversold reference lines.

---

## [0.0.1] — 2026-04-16 (first commit)

### Foundation
- **Next.js 14 App Router** project scaffolded with TypeScript and Tailwind CSS.
- **Coin detail page** (`/coin/[symbol]`) — header with live price and funding rate badge, stats grid (market cap, volume, ATH, drawdown, supply), candlestick chart with RSI and MACD sub-charts, Signal Score card, Technical Analysis section, Volume & Structure section, Multi-Timeframe panel, and Holt-Winters forecast.
- **Dashboard** (`/`) — market summary strip (total market cap, volume, BTC/ETH dominance, Fear & Greed gauge), BTC chart section, and watchlist grid.
- **Alerts page** (`/alerts`) — create price alerts with symbol autocomplete; active alerts polled every 60s; browser Notification API support; toast on trigger.
- **News page** (`/news`) — proxied CryptoCompare feed with tag filters (Bitcoin, Ethereum, DeFi, NFT, Regulation).
- **Signal Scoring Engine** (`lib/scoring.ts`) — composite score −10 to +10 from EMA crossover, price vs EMA200, RSI, MACD histogram, Bollinger Bands, and OBV trend. Labels: Strong Buy / Buy / Neutral / Sell / Strong Sell.
- **Indicator library** (`lib/indicators.ts`) — EMA, RSI (Wilder), MACD, Bollinger Bands, ATR (Wilder), OBV, Stochastic RSI, Volume SMA, Swing Level detection, S/R levels, VWAP (daily reset), ADX + ±DI, Williams %R, Fibonacci retracement, Pivot Points (classic), RSI divergence detection.
- **Pattern library** (`lib/patterns.ts`) — 13 candlestick patterns (Doji, Hammer, Hanging Man, Shooting Star, Inverted Hammer, Marubozu, Spinning Top, Bullish/Bearish Engulfing, Bullish/Bearish Harami, Morning Star, Evening Star, Three White Soldiers, Three Black Crows), trend phase detection (Strong Uptrend → Strong Downtrend).
- **Holt-Winters forecast** (`lib/forecast.ts`) — damped additive exponential smoothing (α=0.3, β=0.1, φ=0.9), 5-step projection, 95% confidence interval bands.
- **CoinPaprika API client** (`lib/coingecko.ts`) — primary market data source (no API key). Dynamic coin ID resolution via symbol map + CoinPaprika search fallback. CoinMarketCap fallback route when CoinPaprika has no data.
- **Binance API client** (`lib/binance.ts`) — klines, 24h ticker, spot price, and futures funding rate. All public endpoints, no key required.
- **React Query** caching throughout with per-endpoint stale times and refetch intervals.
- **Jest test suite** — unit tests for forecast, indicators, and scoring.
- **Vercel deployment config** with Next.js zero-config output.
