import { Suspense } from 'react'
import CoinDetailClient from './coin-detail-client'

interface Props {
  params: { symbol: string }
}

export function generateMetadata({ params }: Props) {
  return {
    title: params.symbol.toUpperCase(),
  }
}

export default function CoinDetailPage({ params }: Props) {
  return (
    <Suspense fallback={<CoinDetailSkeleton />}>
      <CoinDetailClient symbol={params.symbol} />
    </Suspense>
  )
}

function CoinDetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-24 skeleton rounded-xl" />
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 skeleton rounded-xl" />)}
      </div>
      <div className="h-96 skeleton rounded-xl" />
    </div>
  )
}
