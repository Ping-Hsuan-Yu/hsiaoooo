// service_role client：bypass RLS，只能在 server（actions）使用，絕不可洩漏到 client。
// lazy 初始化：缺 env 時於「第一個 admin 請求」才 throw，而非 build/import 時。
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function required(name: string): string {
  const v = process.env[name]
  if (!v || v.trim() === '') throw new Error(`Missing required env: ${name}`)
  return v
}

let client: SupabaseClient | null = null

export function db(): SupabaseClient {
  if (!client) {
    client = createClient(required('NEXT_PUBLIC_SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  }
  return client
}
