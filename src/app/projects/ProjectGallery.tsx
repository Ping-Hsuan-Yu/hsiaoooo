'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { X } from 'lucide-react'
import { dummyProjects, projectTags } from '@/data/projectsDummyData'

export default function ProjectGallery() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const selectedTags = searchParams.getAll('tag')
  const [activeImage, setActiveImage] = useState<string | null>(null)

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
    <div className='w-full'>
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
      <motion.div layout className='w-full columns-2 sm:columns-3 lg:columns-4 gap-3'>
        <AnimatePresence mode='popLayout'>
          {filteredProjects.map(project => (
            <motion.div
              layout
              key={project.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.3 }}
              className='group relative w-full overflow-hidden rounded-none bg-gray-100 mb-3 break-inside-avoid block'>
              {project.type === 'single' ? (
                <div 
                  className="cursor-zoom-in"
                  onClick={() => setActiveImage(project.src!)}
                >
                  <Image
                    src={project.src!}
                    alt={project.tags.join(', ')}
                    width={1200}
                    height={1200}
                    sizes='(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw'
                    className='w-full h-auto rounded-none block hover:scale-105 transition-transform duration-500'
                  />
                </div>
              ) : (
                <div className='w-full aspect-square relative hover:scale-105 transition-transform duration-500 overflow-hidden'>
                  {project.layout === 'layout-1' && (
                    <div className='absolute inset-0 grid grid-cols-2 grid-rows-2 gap-1'>
                      {project.images?.map((img, i) => (
                        <div 
                          key={i} 
                          className='relative w-full h-full cursor-zoom-in'
                          onClick={() => setActiveImage(img)}
                        >
                          <Image
                            src={img}
                            alt=''
                            fill
                            className='object-cover rounded-none block'
                            sizes='(max-width: 640px) 25vw, 15vw'
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {project.layout === 'layout-2' && (
                    <div className='absolute inset-0 flex flex-col gap-1'>
                      <div 
                        className='relative w-full h-[66.666%] cursor-zoom-in'
                        onClick={() => setActiveImage(project.images![0])}
                      >
                        <Image
                          src={project.images![0]}
                          alt=''
                          fill
                          className='object-cover rounded-none block'
                          sizes='(max-width: 640px) 50vw, 25vw'
                        />
                      </div>
                      <div className='relative w-full h-[33.333%] grid grid-cols-3 gap-1'>
                        {project.images?.slice(1, 4).map((img, i) => (
                          <div 
                            key={i} 
                            className='relative w-full h-full cursor-zoom-in'
                            onClick={() => setActiveImage(img)}
                          >
                            <Image
                              src={img}
                              alt=''
                              fill
                              className='object-cover rounded-none block'
                              sizes='(max-width: 640px) 15vw, 10vw'
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {project.layout === 'layout-3' && (
                    <div className='absolute inset-0 flex gap-1'>
                      <div 
                        className='relative h-full w-[66.666%] cursor-zoom-in'
                        onClick={() => setActiveImage(project.images![0])}
                      >
                        <Image
                          src={project.images![0]}
                          alt=''
                          fill
                          className='object-cover rounded-none block'
                          sizes='(max-width: 640px) 50vw, 25vw'
                        />
                      </div>
                      <div className='relative h-full w-[33.333%] grid grid-rows-3 gap-1'>
                        {project.images?.slice(1, 4).map((img, i) => (
                          <div 
                            key={i} 
                            className='relative w-full h-full cursor-zoom-in'
                            onClick={() => setActiveImage(img)}
                          >
                            <Image
                              src={img}
                              alt=''
                              fill
                              className='object-cover rounded-none block'
                              sizes='(max-width: 640px) 15vw, 10vw'
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* Hover 遮罩效果 */}
              <div className='absolute inset-0 bg-white/70 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center p-4 text-center pointer-events-none'>
                <h3 className='text-xl font-bold text-black mb-2'>專案展示標題</h3>
                <p className='text-sm text-gray-800'>{project.tags.join(', ')}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {/* 放大圖片的 Lightbox Modal */}
      <AnimatePresence>
        {activeImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveImage(null)}
            className='fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 cursor-zoom-out'>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className='relative max-w-5xl max-h-[90vh] w-full h-[80vh] flex items-center justify-center'
              onClick={e => e.stopPropagation()}>
              <div className='relative w-full h-full'>
                <Image
                  src={activeImage}
                  alt='Enlarged project image'
                  fill
                  className='object-contain'
                  sizes='100vw'
                  priority
                />
              </div>
              <button
                onClick={() => setActiveImage(null)}
                className='absolute top-4 right-4 text-white hover:text-gray-300 bg-black/50 hover:bg-black/80 rounded-full p-2 transition-colors cursor-pointer z-10'>
                <X className='w-6 h-6' />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {filteredProjects.length === 0 && (
        <div className='text-center py-20 text-gray-500'>目前沒有符合此標籤的作品。</div>
      )}
    </div>
  )
}
