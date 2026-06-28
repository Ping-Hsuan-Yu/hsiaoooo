import { Suspense } from 'react'
import { getProjects } from '@/lib/projects'
import ProjectGallery from './ProjectGallery'

// ISR：每小時最多重抓一次 DB，re-seed 後不必重新部署也會更新（可自行調整秒數）
export const revalidate = 3600

export default async function ProjectsPage() {
  const projects = await getProjects()

  return (
    <div className=' mt-20 min-h-screen'>
      <h1 className='text-4xl font-bold mb-8 text-black'>所有的作品</h1>
      {/* ProjectGallery 用 useSearchParams，需包在 Suspense 內 */}
      <Suspense fallback={<div className='text-center py-20'>載入中...</div>}>
        <ProjectGallery projects={projects} />
      </Suspense>
    </div>
  )
}
