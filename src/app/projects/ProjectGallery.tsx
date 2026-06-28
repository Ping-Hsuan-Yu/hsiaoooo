'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams, useRouter } from 'next/navigation'
import { CldImage, getCldImageUrl } from 'next-cloudinary'
import { X } from 'lucide-react'
import { type Project, type ProjectImage, deriveTags } from '@/lib/projects'

export default function ProjectGallery({ projects }: { projects: Project[] }) {
  const searchParams = useSearchParams()
  const router = useRouter()

  const selectedTags = searchParams.getAll('tag')
  const projectTags = deriveTags(projects)

  type ActiveImage = { src: string; rect: { top: number; left: number; width: number; height: number }; natW: number; natH: number }
  const [activeImage, setActiveImage] = useState<ActiveImage | null>(null)

  // 點擊圖片：記錄畫面上的原始位置/大小，原始比例直接用 DB 存的 width/height（免 async 載圖）
  const openLightbox = (img: ProjectImage, e: React.MouseEvent<HTMLElement>) => {
    const { top, left, width, height } = e.currentTarget.getBoundingClientRect()
    setActiveImage({ src: getCldImageUrl({ src: img.publicId }), rect: { top, left, width, height }, natW: img.width, natH: img.height })
  }

  // 依原始比例，計算置中、最大填滿視窗 92% 的目標方框
  const getTargetRect = (natW: number, natH: number) => {
    const maxW = window.innerWidth * 0.92
    const maxH = window.innerHeight * 0.92
    const ratio = Math.min(maxW / natW, maxH / natH)
    const width = natW * ratio
    const height = natH * ratio
    return { width, height, left: (window.innerWidth - width) / 2, top: (window.innerHeight - height) / 2 }
  }

  const toggleTag = (tag: string) => {
    const newTags = new Set(selectedTags)
    newTags.has(tag) ? newTags.delete(tag) : newTags.add(tag)
    const params = new URLSearchParams()
    newTags.forEach(t => params.append('tag', t))
    router.replace(`/projects?${params.toString()}`, { scroll: false })
  }

  const navigateToAll = () => router.replace('/projects', { scroll: false })

  const filteredProjects = projects.filter(project => {
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
          {filteredProjects.map((project, i) => {
            const cover = project.images[0]
            return (
              <motion.div
                layout
                key={project.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.3 }}
                className='group relative w-full overflow-hidden rounded-none bg-gray-100 mb-3 break-inside-avoid block'>
                {project.type === 'single' ? (
                  <div className='cursor-zoom-in' onClick={e => openLightbox(cover, e)}>
                    <CldImage
                      src={cover.publicId}
                      alt={cover.alt || project.title || project.tags.join(', ')}
                      width={cover.width}
                      height={cover.height}
                      crop='limit'
                      priority={i < 4}
                      sizes='(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw'
                      className='w-full h-auto rounded-none block hover:scale-105 transition-transform duration-500'
                    />
                  </div>
                ) : (
                  <div className='w-full aspect-square relative hover:scale-105 transition-transform duration-500 overflow-hidden'>
                    {project.layout === 'layout-1' && (
                      <div className='absolute inset-0 grid grid-cols-2 grid-rows-2 gap-1'>
                        {project.images.map((img, i) => (
                          <div key={i} className='relative w-full h-full cursor-zoom-in' onClick={e => openLightbox(img, e)}>
                            <CldImage src={img.publicId} alt={img.alt} fill crop='limit' className='object-cover rounded-none block' sizes='(max-width: 640px) 25vw, 15vw' />
                          </div>
                        ))}
                      </div>
                    )}
                    {project.layout === 'layout-2' && (
                      <div className='absolute inset-0 flex flex-col gap-1'>
                        <div className='relative w-full h-[66.666%] cursor-zoom-in' onClick={e => openLightbox(project.images[0], e)}>
                          <CldImage src={project.images[0].publicId} alt={project.images[0].alt} fill crop='limit' className='object-cover rounded-none block' sizes='(max-width: 640px) 50vw, 25vw' />
                        </div>
                        <div className='relative w-full h-[33.333%] grid grid-cols-3 gap-1'>
                          {project.images.slice(1, 4).map((img, i) => (
                            <div key={i} className='relative w-full h-full cursor-zoom-in' onClick={e => openLightbox(img, e)}>
                              <CldImage src={img.publicId} alt={img.alt} fill crop='limit' className='object-cover rounded-none block' sizes='(max-width: 640px) 15vw, 10vw' />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {project.layout === 'layout-3' && (
                      <div className='absolute inset-0 flex gap-1'>
                        <div className='relative h-full w-[66.666%] cursor-zoom-in' onClick={e => openLightbox(project.images[0], e)}>
                          <CldImage src={project.images[0].publicId} alt={project.images[0].alt} fill crop='limit' className='object-cover rounded-none block' sizes='(max-width: 640px) 50vw, 25vw' />
                        </div>
                        <div className='relative h-full w-[33.333%] grid grid-rows-3 gap-1'>
                          {project.images.slice(1, 4).map((img, i) => (
                            <div key={i} className='relative w-full h-full cursor-zoom-in' onClick={e => openLightbox(img, e)}>
                              <CldImage src={img.publicId} alt={img.alt} fill crop='limit' className='object-cover rounded-none block' sizes='(max-width: 640px) 15vw, 10vw' />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {/* Hover 遮罩：顯示專案 title / description（皆空則 fallback 用 tags） */}
                <div className='absolute inset-0 bg-white/70 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center p-4 text-center pointer-events-none'>
                  <h3 className='text-xl font-bold text-black mb-2'>{project.title || '專案展示'}</h3>
                  <p className='text-sm text-gray-800'>{project.description || project.tags.join(', ')}</p>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </motion.div>

      {/* Lightbox：從點擊圖片的原始位置/大小放大到全螢幕 */}
      <AnimatePresence>
        {activeImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={() => setActiveImage(null)}
            className='fixed inset-0 z-50 bg-black/90 cursor-zoom-out'>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <motion.img
              src={activeImage.src}
              alt='Enlarged project image'
              onClick={e => e.stopPropagation()}
              className='fixed object-cover cursor-zoom-out will-change-transform'
              initial={{ top: activeImage.rect.top, left: activeImage.rect.left, width: activeImage.rect.width, height: activeImage.rect.height }}
              animate={getTargetRect(activeImage.natW, activeImage.natH)}
              exit={{ top: activeImage.rect.top, left: activeImage.rect.left, width: activeImage.rect.width, height: activeImage.rect.height }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            />
            <button
              onClick={() => setActiveImage(null)}
              className='fixed top-4 right-4 text-white hover:text-gray-300 bg-black/50 hover:bg-black/80 rounded-full p-2 transition-colors cursor-pointer z-10'>
              <X className='w-6 h-6' />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {filteredProjects.length === 0 && (
        <div className='text-center py-20 text-gray-500'>目前沒有符合此標籤的作品。</div>
      )}
    </div>
  )
}
