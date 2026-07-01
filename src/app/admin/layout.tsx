import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${inter.variable} font-admin`}>{children}</div>
}
