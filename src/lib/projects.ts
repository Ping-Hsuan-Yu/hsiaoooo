import { createClient } from '@supabase/supabase-js'

export type GroupLayoutType = 'layout-1' | 'layout-2' | 'layout-3'

export type ProjectImage = {
  url: string
  width: number
  height: number
  alt: string
  publicId: string
}

export type Project = {
  id: string
  title: string
  description: string
  order: number
  tags: string[]
  type: 'single' | 'group'
  layout: GroupLayoutType | null
  images: ProjectImage[]
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// 公開讀取，依 order ASC, created_at DESC 取得確定性排序
export async function getProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) {
    // ponytail: 讀取失敗回空陣列，前台顯示空狀態而非整頁 crash；錯誤進 server log
    console.error('[getProjects]', error.message)
    return []
  }
  return (data ?? []) as Project[]
}

// 依資料庫實際資料動態產出 filter 標籤（first-seen 順序），不寫死於前端
export function deriveTags(projects: Project[]): string[] {
  const seen = new Set<string>()
  for (const p of projects) for (const t of p.tags) seen.add(t)
  return [...seen]
}
