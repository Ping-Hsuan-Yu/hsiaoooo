import type { Metadata } from 'next'
import { Abhaya_Libre, Inria_Sans, Noto_Sans_TC } from 'next/font/google'

import './globals.css'

const inriaSans = Inria_Sans({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-inria-sans'
})

const notoSansTC = Noto_Sans_TC({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-noto-sans-tc'
})

const abhayaLibre = Abhaya_Libre({
  subsets: ['latin'],
  weight: '500',
  variable: '--font-abhaya-libre'
})

export const metadata: Metadata = {
  title: 'Hsiaoooo',
  description: 'Hsiaoooo'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang='zh-TW'
      className={`${inriaSans.variable} ${notoSansTC.variable} ${abhayaLibre.variable}`}>
      <body>
        <div className='flex flex-col gap-20 layout-index'>
          {children}
          <div className='font-abhaya text-center mb-4'>©2025 YingHsiao</div>
        </div>
      </body>
    </html>
  )
}
