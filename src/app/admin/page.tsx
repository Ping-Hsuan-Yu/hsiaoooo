import { getProjects } from '@/lib/projects'
import AdminDashboard from './AdminDashboard'

// 後台一律即時讀取，不快取
export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const projects = await getProjects()
  return <AdminDashboard initialProjects={projects} />
}
