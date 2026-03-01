import { Suspense } from 'react'
import ProjectGallery from './ProjectGallery'

export default function ProjectsPage() {
  return (
    <div className='container mx-auto px-4 py-16 mt-20 min-h-screen'>
      <h1 className='text-4xl font-bold mb-8 text-black'>所有的作品</h1>
      <Suspense fallback={<div className='text-center py-20'>載入中...</div>}>
        <ProjectGallery />
      </Suspense>
    </div>
  )
}
