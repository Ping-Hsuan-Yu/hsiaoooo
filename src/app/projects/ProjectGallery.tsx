'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { dummyProjects, projectTags } from '@/data/projectsDummyData'

export default function ProjectGallery() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const selectedTags = searchParams.getAll('tag')

  const toggleTag = (tag: string) => {
    const newTags = new Set(selectedTags)
    if (newTags.has(tag)) {
      newTags.delete(tag)
    } else {
      newTags.add(tag)
    }

    const params = new URLSearchParams()
    newTags.forEach(t => params.append('tag', t))
    router.replace(`/projects?${params.toString()}`, { scroll: false })
  }

  const navigateToAll = () => {
    router.replace('/projects', { scroll: false })
  }

  const filteredProjects = dummyProjects.filter(project => {
    if (selectedTags.length === 0) return true
    return selectedTags.some(tag => project.tags.includes(tag))
  })

  return (
    <div>
      {/* 篩選器 Filters */}
      <div className='flex flex-wrap gap-3 mb-10'>
        <button
          onClick={navigateToAll}
          className={`px-4 py-2 rounded-full border transition-colors ${
            selectedTags.length === 0
              ? 'bg-black text-white border-black'
              : 'bg-transparent text-black border-gray-300 hover:border-black'
          }`}>
          全部
        </button>
        {projectTags.map(tag => (
          <button
            key={tag}
            onClick={() => toggleTag(tag)}
            className={`px-4 py-2 rounded-full border transition-colors ${
              selectedTags.includes(tag)
                ? 'bg-black text-white border-black'
                : 'bg-transparent text-black border-gray-300 hover:border-black'
            }`}>
            {tag}
          </button>
        ))}
      </div>

      {/* 圖片網格 Image Grid */}
      <motion.div layout className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'>
        <AnimatePresence mode='popLayout'>
          {filteredProjects.map(project => (
            <motion.div
              layout
              key={project.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.3 }}
              className='relative aspect-square overflow-hidden rounded-lg bg-gray-100'>
              <Image
                src={project.src}
                alt={project.tags.join(', ')}
                fill
                sizes='(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw'
                className='object-cover hover:scale-105 transition-transform duration-500'
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {filteredProjects.length === 0 && (
        <div className='text-center py-20 text-gray-500'>目前沒有符合此標籤的作品。</div>
      )}
    </div>
  )
}
