// Admin server-only env，存取時才驗證 → 缺值即 throw，防止「無密碼登入」漏洞。
// 不能 import node-only 模組：本檔會被 middleware（edge runtime）間接 import。

function required(name: string): string {
  const v = process.env[name]
  if (!v || v.trim() === '') {
    throw new Error(`Missing required env: ${name}（admin 後台需要此變數，請設定 .env / Vercel env）`)
  }
  return v
}

export const adminConfig = {
  get password() {
    return required('ADMIN_PASSWORD')
  },
  get sessionSecret() {
    const s = required('ADMIN_SESSION_SECRET')
    if (s.length < 32) throw new Error('ADMIN_SESSION_SECRET 至少需 32 字元')
    return s
  }
}
