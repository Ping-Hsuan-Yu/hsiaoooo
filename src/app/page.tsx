import About from '@/app/(sections)/About'
import Contact from '@/app/(sections)/Contact'
import Hello from '@/app/(sections)/Hello'
import Pricing from '@/app/(sections)/Pricing'
import Project from '@/app/(sections)/Project'

// ISR：每小時最多重抓一次 DB，後台改分類/定價後最多等這麼久才會反映（也會被 admin action 的 revalidatePath('/') 立即刷新）
export const revalidate = 3600

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
