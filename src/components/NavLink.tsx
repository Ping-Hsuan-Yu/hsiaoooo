'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// 取代 Vike 的 Link.tsx（原本用 usePageContext 判斷 active）。
// 比對時去掉 hash，'/' 需完全相等，其餘路徑用 startsWith。
export function NavLink({
  href,
  className,
  children
}: {
  href: string
  className?: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const path = href.split('#')[0] || '/'
  const isActive = path === '/' ? pathname === '/' : pathname.startsWith(path)

  return (
    <Link href={href} className={[className, isActive ? 'is-active' : ''].filter(Boolean).join(' ')}>
      {children}
    </Link>
  )
}
