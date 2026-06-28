// ponytail: in-memory IP window。serverless cold start / 多實例會各自重置計數，
// 對單人後台足夠；要跨實例持久就換 Upstash Ratelimit。
const WINDOW_MS = 15 * 60 * 1000
const MAX_FAILS = 5

const hits = new Map<string, { count: number; resetAt: number }>()

// 還有額度可嘗試 → true；已達上限 → false
export function canAttempt(ip: string): boolean {
  const now = Date.now()
  const e = hits.get(ip)
  if (!e || now > e.resetAt) return true
  return e.count < MAX_FAILS
}

export function recordFail(ip: string): void {
  const now = Date.now()
  const e = hits.get(ip)
  if (!e || now > e.resetAt) hits.set(ip, { count: 1, resetAt: now + WINDOW_MS })
  else e.count++
}

export function reset(ip: string): void {
  hits.delete(ip)
}
