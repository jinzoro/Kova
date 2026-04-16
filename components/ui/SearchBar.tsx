'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import CoinLogo from '@/components/ui/CoinLogo'
import { searchCoins } from '@/lib/coingecko'

interface Suggestion {
  id: string
  name: string
  symbol: string
  market_cap_rank: number
  thumb: string
}

export default function SearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(-1)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!query.trim()) { setResults([]); setOpen(false); return }

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await searchCoins(query)
        setResults(data.coins.slice(0, 8))
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query])

  const navigate = (symbol: string) => {
    router.push(`/coin/${symbol.toLowerCase()}`)
    setQuery('')
    setOpen(false)
    setSelected(-1)
    inputRef.current?.blur()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, -1)) }
    if (e.key === 'Enter' && selected >= 0) navigate(results[selected].symbol)
    if (e.key === 'Escape') { setOpen(false); setSelected(-1) }
  }

  return (
    <div className="relative">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search coins…"
          className="input pl-9 pr-3 h-9"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full mt-1 w-full bg-surface-card border border-surface-border rounded-xl shadow-xl z-50 overflow-hidden animate-slide-up">
          {results.map((coin, i) => (
            <button
              key={coin.id}
              onMouseDown={() => navigate(coin.symbol)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors ${
                i === selected ? 'bg-blue-600/20 text-blue-300' : 'hover:bg-surface-muted text-gray-300'
              }`}
            >
              <CoinLogo src={coin.thumb} alt={coin.symbol} size={20} />
              <span className="font-medium">{coin.name}</span>
              <span className="text-gray-500 font-mono text-xs uppercase ml-1">{coin.symbol}</span>
              {coin.market_cap_rank && (
                <span className="ml-auto text-gray-500 text-xs">#{coin.market_cap_rank}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
