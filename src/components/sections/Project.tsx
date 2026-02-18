const projects = [
  { title: '社群專案', description: '粉絲專頁圖文設計', link: '' },
  { title: '廣告Banner', description: '廣告素材 / 電商圖片', link: '' },
  {
    title: '一頁式Landing page',
    description: '商品頁面 / 銷售頁面製作',
    link: ''
  },
  { title: '動畫製作', description: '簡易小動畫 / GIF', link: '' },
  {
    title: '插畫設計',
    description: '貼圖 / 吉祥物 / 自由創作作品',
    link: ''
  },
  {
    title: '視覺設計',
    description: 'LOGO設計 / 招牌設計 / 菜單設計 / 名片設計',
    link: ''
  },
  { title: '商品攝影', description: '商品拍攝後製 / 情境拍攝', link: '' }
]

export default function Project() {
  return (
    <div id='project'>
      <div className='mb-8'>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src='/images/project.svg' alt='Project' />
      </div>
      <div className='project-list'>
        {projects.map(project => (
          <ProjectCard
            key={project.title}
            title={project.title}
            description={project.description}
            link={project.link}
          />
        ))}
      </div>
    </div>
  )
}

function ProjectCard({ title, description }: { title: string; description: string; link: string }) {
  return (
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
  )
}
