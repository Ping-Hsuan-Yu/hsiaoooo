import type { Metadata } from 'next'
import { Abhaya_Libre, Inria_Sans } from 'next/font/google'
import localFont from 'next/font/local'

import './globals.css'

const inriaSans = Inria_Sans({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-inria-sans'
})

const lineSeedTW = localFont({
  src: [
    { path: './fonts/LINESeedTW_OTF_Th.woff2', weight: '100', style: 'normal' },
    { path: './fonts/LINESeedTW_OTF_Rg.woff2', weight: '400', style: 'normal' },
    { path: './fonts/LINESeedTW_OTF_Bd.woff2', weight: '700', style: 'normal' },
    { path: './fonts/LINESeedTW_OTF_Eb.woff2', weight: '800', style: 'normal' }
  ],
  variable: '--font-line-seed-tw'
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
      className={`${inriaSans.variable} ${lineSeedTW.variable} ${abhayaLibre.variable}`}>
      <body>
        <div className='flex flex-col gap-20 layout-index'>
          {children}
          <div className='font-abhaya text-center mb-4'>©2025 YingHsiao</div>
        </div>
      </body>
    </html>
  )
}
