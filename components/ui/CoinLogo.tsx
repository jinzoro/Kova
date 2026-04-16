'use client'

import Image from 'next/image'
import { useState } from 'react'

interface Props {
  src: string
  alt: string
  size?: number
  className?: string
}

/** Coin logo with automatic text fallback when the image 404s */
export default function CoinLogo({ src, alt, size = 28, className = '' }: Props) {
  const [errored, setErrored] = useState(false)
  const initial = alt?.[0]?.toUpperCase() ?? '?'

  if (!src || errored) {
    return (
      <div
        className={`rounded-full bg-surface-muted flex items-center justify-center font-bold text-gray-400 shrink-0 ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {initial}
      </div>
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={`rounded-full shrink-0 ${className}`}
      onError={() => setErrored(true)}
      unoptimized
    />
  )
}
