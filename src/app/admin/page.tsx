import { getProjects, getProjectCategories, getPricingItems } from '@/lib/projects'
import AdminDashboard from './AdminDashboard'

// 後台一律即時讀取，不快取
export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const [projects, categories, pricing] = await Promise.all([
    getProjects(),
    getProjectCategories(),
    getPricingItems()
  ])
  return <AdminDashboard initialProjects={projects} initialCategories={categories} initialPricing={pricing} />
}
