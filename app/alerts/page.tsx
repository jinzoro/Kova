import { Metadata } from 'next'
import AlertsClient from './alerts-client'

export const metadata: Metadata = { title: 'Price Alerts' }

export default function AlertsPage() {
  return <AlertsClient />
}
