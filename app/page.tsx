import { Suspense } from 'react'
import DashboardClient from './dashboard-client'

export const metadata = {
  title: 'Dashboard',
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardClient />
    </Suspense>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-16 skeleton rounded-xl" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-40 skeleton rounded-xl" />
        ))}
      </div>
    </div>
  )
}
