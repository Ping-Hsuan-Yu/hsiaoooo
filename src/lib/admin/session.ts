// Session = `<expiresAt>.<HMAC-SHA256(expiresAt, secret)>`，存於 httpOnly cookie。
// 用 Web Crypto（非 node:crypto）→ middleware（edge）與 server action（node）都能跑。
import { adminConfig } from './config'

export const SESSION_COOKIE = 'admin_session'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 天（秒）

const encoder = new TextEncoder()

async function hmacHex(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(adminConfig.sessionSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('')
}

// 常數時間比對等長 hex（HMAC hex 固定 64 字元，長度差異不洩漏敏感資訊）
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function createSessionValue(): Promise<string> {
  const expiresAt = Date.now() + SESSION_MAX_AGE * 1000
  return `${expiresAt}.${await hmacHex(String(expiresAt))}`
}

export async function verifySessionValue(value: string | undefined | null): Promise<boolean> {
  if (!value) return false
  const [expiresAtStr, signature] = value.split('.')
  if (!expiresAtStr || !signature) return false
  const expiresAt = Number(expiresAtStr)
  if (!Number.isFinite(expiresAt) || Date.now() >= expiresAt) return false
  return timingSafeEqualHex(signature, await hmacHex(expiresAtStr))
}
