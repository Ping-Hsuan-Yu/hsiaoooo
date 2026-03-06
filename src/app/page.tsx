import About from '@/app/(sections)/About'
import Contact from '@/app/(sections)/Contact'
import Hello from '@/app/(sections)/Hello'
import Pricing from '@/app/(sections)/Pricing'
import Project from '@/app/(sections)/Project'

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
