import About from '@/components/sections/About'
import Contact from '@/components/sections/Contact'
import Hello from '@/components/sections/Hello'
import Pricing from '@/components/sections/Pricing'
import Project from '@/components/sections/Project'

export default function Home() {
  return (
    <>
      <Hello />
      <About />
      <Project />
      <Pricing />
      <Contact />
    </>
  )
}
