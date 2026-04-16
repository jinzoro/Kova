'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import SearchBar from '@/components/ui/SearchBar'

const NAV_LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/alerts', label: 'Alerts' },
  { href: '/news', label: 'News' },
]

export default function Navbar() {
  const pathname = usePathname()
  const [dark, setDark] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('light', !dark)
  }, [dark])

  return (
    <nav className="sticky top-0 z-50 bg-surface-card/80 backdrop-blur-md border-b border-surface-border">
      <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Kova
          </span>
          <span className="hidden sm:inline text-xs text-gray-500 font-mono uppercase tracking-widest">
            Intelligence
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1 ml-2">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                pathname === href
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-surface-muted'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Search */}
        <div className="flex-1 max-w-sm mx-auto">
          <SearchBar />
        </div>

        {/* Theme toggle + mobile */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDark(!dark)}
            className="btn-ghost text-lg p-2"
            aria-label="Toggle theme"
          >
            {dark ? '☀️' : '🌙'}
          </button>
          <button
            className="md:hidden btn-ghost p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d={mobileOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-surface-border bg-surface-card px-4 py-2 flex flex-col gap-1">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`px-3 py-2 rounded-lg text-sm font-medium ${
                pathname === href
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-gray-400'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  )
}
