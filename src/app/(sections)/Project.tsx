import Link from 'next/link'
import { getProjectCategories } from '@/lib/projects'

export default async function Project() {
  const categories = await getProjectCategories()

  return (
    <div id='project'>
      <div className='mb-8'>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src='/images/project.svg' alt='Project' />
      </div>
      <div className='project-list'>
        {categories.map(category => (
          <ProjectCard
            key={category.id}
            title={category.title}
            description={category.description}
            link={`/projects?tag=${encodeURIComponent(category.title)}`}
          />
        ))}
      </div>
    </div>
  )
}

function ProjectCard({
  title,
  description,
  link
}: {
  title: string
  description: string
  link: string
}) {
  return (
    <Link href={link} className='block'>
      <div className='project border-b-2 flex justify-between items-center py-3 md:py-6 cursor-pointer transition-opacity duration-200 ease-in-out-sine hover:opacity-100!'>
        <div className='flex flex-col md:flex-row items-baseline gap-2'>
          <div className='text-2xl font-bold'>{title}</div>
          <div className='text-sm text-light-gray'>{description}</div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className='w-8 arrow invisible transform -translate-x-4 transition-transform duration-400 ease-in-out'
          src='/images/arrow.svg'
          alt=''
        />
      </div>
    </Link>
  )
}
