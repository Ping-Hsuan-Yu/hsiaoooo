import { NavLink } from '@/components/NavLink'

export default function Hello() {
  return (
    <div className='bg-fluid h-dvh'>
      <NavBar />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src='/images/bouzi-universe.svg'
        alt='Bouzi Universe'
        className='absolute left-4 md:left-8 lg:left-16 bottom-8'
      />
    </div>
  )
}

const menuItems = [
  { name: 'Hello', link: '/' },
  { name: 'About', link: '/#about' },
  { name: 'Project', link: '/#project' },
  { name: 'Pricing', link: '/#pricing' },
  { name: 'Contact', link: '/#contact' }
]

function NavBar() {
  return (
    <div id='nav-bar' className='font-abhaya pt-8'>
      <ul>
        {menuItems.map((item, index) => (
          <li key={item.name}>
            <NavLink href={item.link} className='flex items-baseline gap-1'>
              <span className='text-lg'>0{index + 1}</span>
              <span>✦</span>
              <span className='uppercase'>{item.name}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}
