import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import PageLoader from '../components/layout/PageLoader'
import AdminLayout from './AdminLayout'

/** Shared admin shell — keep layout mounted; only page body suspends. */
export default function AdminPortal() {
  return (
    <AdminLayout mode="admin">
      <Suspense fallback={<PageLoader label="Loading page" />}>
        <Outlet />
      </Suspense>
    </AdminLayout>
  )
}
