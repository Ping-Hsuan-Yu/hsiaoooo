import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, verifySessionValue } from '@/lib/admin/session'

// 統一保護 /admin/*：未登入一律 rewrite 到登入頁；已登入訪登入頁則導回 dashboard。
// 注意：Server Actions 仍須各自呼叫 requireSession()，不可只信任 proxy。
export async function proxy(req: NextRequest) {
  const ok = await verifySessionValue(req.cookies.get(SESSION_COOKIE)?.value)
  const { pathname } = req.nextUrl

  if (!ok && pathname !== '/admin/login') {
    return NextResponse.rewrite(new URL('/admin/login', req.url))
  }
  if (ok && pathname === '/admin/login') {
    return NextResponse.redirect(new URL('/admin', req.url))
  }
  return NextResponse.next()
}

export const config = { matcher: ['/admin/:path*'] }
