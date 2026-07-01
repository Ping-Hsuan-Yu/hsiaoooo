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

export type ProjectCategory = {
  id: string
  title: string
  description: string
  order: number
}

export type ProjectCategoryWithUsage = ProjectCategory & { usageCount: number }

export type PricingItem = {
  id: string
  title: string
  description: string
  price: string
  order: number
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type ProjectRow = Omit<Project, 'tags'> & {
  project_tags: { project_categories: { title: string } }[]
}

// 公開讀取，依 order ASC, created_at DESC 取得確定性排序
export async function getProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*, project_tags(project_categories(title))')
    .order('order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) {
    // ponytail: 讀取失敗回空陣列，前台顯示空狀態而非整頁 crash；錯誤進 server log
    console.error('[getProjects]', error.message)
    return []
  }

  return ((data ?? []) as ProjectRow[]).map(({ project_tags, ...rest }) => ({
    ...rest,
    tags: project_tags.map(pt => pt.project_categories.title)
  }))
}

// 依資料庫實際資料動態產出 filter 標籤（first-seen 順序），不寫死於前端
export function deriveTags(projects: Project[]): string[] {
  const seen = new Set<string>()
  for (const p of projects) for (const t of p.tags) seen.add(t)
  return [...seen]
}

// 分類清單 + 每個分類目前被幾個作品使用（後台刪除確認要顯示受影響數）
export async function getProjectCategories(): Promise<ProjectCategoryWithUsage[]> {
  const [{ data: categories, error: catErr }, { data: tagRows, error: tagErr }] = await Promise.all([
    supabase.from('project_categories').select('*').order('order', { ascending: true }),
    supabase.from('project_tags').select('category_id')
  ])

  if (catErr) {
    console.error('[getProjectCategories]', catErr.message)
    return []
  }
  if (tagErr) console.error('[getProjectCategories:usage]', tagErr.message)

  const counts = new Map<string, number>()
  for (const row of (tagRows ?? []) as { category_id: string }[]) {
    counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1)
  }

  return ((categories ?? []) as ProjectCategory[]).map(c => ({
    ...c,
    usageCount: counts.get(c.id) ?? 0
  }))
}

export async function getPricingItems(): Promise<PricingItem[]> {
  const { data, error } = await supabase
    .from('pricing_items')
    .select('*')
    .order('order', { ascending: true })

  if (error) {
    console.error('[getPricingItems]', error.message)
    return []
  }
  return (data ?? []) as PricingItem[]
}
