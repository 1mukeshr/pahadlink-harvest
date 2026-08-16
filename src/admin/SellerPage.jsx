import { Suspense } from 'react'
import PageLoader from '../components/layout/PageLoader'
import AdminLayout from './AdminLayout'
import OrdersDesk from './OrdersDesk'

/** Seller desk — layout stays mounted; desk can suspend inside. */
export default function SellerPage() {
  return (
    <AdminLayout mode="seller">
      <Suspense fallback={<PageLoader label="Loading sellers" />}>
        <OrdersDesk mode="seller" view="full" bare />
      </Suspense>
    </AdminLayout>
  )
}
