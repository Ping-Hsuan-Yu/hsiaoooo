# 後台內容管理擴充（分類 + 定價）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把首頁的 Project 分類卡片與 Pricing 卡片從硬編碼陣列改成資料庫驅動，後台可 CRUD + 拖曳排序；作品的標籤改成從分類表多選，刪除分類時關聯標籤自動清除。

**Architecture:** 新增 `project_categories`、`project_tags`（作品↔分類關聯）、`pricing_items` 三張表（FK + `on delete cascade`）。`projects.tags text[]` 欄位移除，`getProjects()` 改用 join 組出等價的 `tags: string[]`，前台/既有元件的資料形狀不變。後台 `AdminDashboard` 拆成 Tabs 外殼 + 三個 Tab 元件，三個列表共用同一個拖曳排序 hook。

**Tech Stack:** Next.js App Router Server Actions、Supabase（Postgres + supabase-js，MCP 工具直接對 remote project 跑 migration，本專案沒有本地 `supabase/` migration 檔案，沿用現有慣例）、`@base-ui/react`（Select 原生支援 `multiple`、Tabs 支援 `variant="line"`）、framer-motion `Reorder`。

Supabase project_id：`hrrjzivqhnwencrxnyhu`（後續步驟直接用這個 id）。

## Global Constraints

- `project_categories.title` 必須 `unique`（前台 `/projects?tag=title` 用字串比對篩選）。
- 所有 FK 用 `on delete cascade`（分類/作品刪除時，關聯列自動清除，不寫應用層清除邏輯）。
- 新表 RLS：只開一條 `"Public read"` policy，`for select to anon, authenticated using (true)`——完全比照現有 `projects` 表的唯一 policy。寫入一律走 `src/lib/admin/supabaseAdmin.ts` 的 service-role client，不開 anon 寫入 policy。
- 所有 mutate action 沿用現有 pattern：先 `await requireSession()`，成功後呼叫擴充版 `revalidateAll()`（`revalidatePath('/')` + `/projects` + `/admin`）。
- Tab 標籤文字固定：「作品」「分類」「定價」。Tabs 用 `variant="line"`。
- 作品完全無標籤時，後台編輯畫面顯示非阻擋性提示文字，文字固定為「標籤未設定」，不擋 submit。
- 刪除分類且有作品使用該標籤時，確認視窗文字固定為：`有 ${count} 個作品使用此標籤，刪除後將一併移除，此操作無法復原。`；`count === 0` 時文字為 `此操作無法復原。`
- 不新增任何 npm 套件（Select 多選、Tabs 都是已安裝的 `@base-ui/react` 原生能力，Tabs 元件用 `npx shadcn add` 產生檔案，不是新依賴）。
- 這個專案沒有測試框架（無 jest/vitest），也沒有本地 `supabase/` migration 目錄。驗證手段一律是：`npx tsc --noEmit` 做型別檢查、Supabase MCP 的 `execute_sql` 做資料庫層驗證、`npm run dev` + 瀏覽器做 UI 行為驗證。不要為此新增測試框架（YAGNI）。

---

### Task 1: 資料庫 schema — 分類、定價、作品-分類關聯表

**Files:**
- 無本地檔案變更（migration 直接用 Supabase MCP `apply_migration` 套用到 remote project，比照本專案現有兩筆 migration `init_projects`、`recreate_projects_jsonb` 的作法，這個 repo 沒有本地 `supabase/migrations` 目錄）。

**Interfaces:**
- Produces：`project_categories(id, title, description, "order", created_at, updated_at)`、`project_tags(project_id, category_id)`、`pricing_items(id, title, description, price, "order", created_at, updated_at)` 三張表，後續所有 Task 都依賴這個 schema。

- [ ] **Step 1: 套用 migration**

用 `mcp__supabase__apply_migration`，`project_id: "hrrjzivqhnwencrxnyhu"`，`name: "add_categories_and_pricing_tables"`，`query`：

```sql
create table project_categories (
  id uuid primary key default gen_random_uuid(),
  title text not null unique,
  description text not null default '',
  "order" int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table project_tags (
  project_id uuid not null references projects(id) on delete cascade,
  category_id uuid not null references project_categories(id) on delete cascade,
  primary key (project_id, category_id)
);

create table pricing_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  price text not null,
  "order" int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table project_categories enable row level security;
alter table project_tags enable row level security;
alter table pricing_items enable row level security;

create policy "Public read" on project_categories for select to anon, authenticated using (true);
create policy "Public read" on project_tags for select to anon, authenticated using (true);
create policy "Public read" on pricing_items for select to anon, authenticated using (true);
```

- [ ] **Step 2: 驗證 schema 與 RLS policy**

用 `mcp__supabase__execute_sql`，`project_id: "hrrjzivqhnwencrxnyhu"`：

```sql
select tablename, policyname, cmd, roles from pg_policies
where tablename in ('project_categories', 'project_tags', 'pricing_items');
```

Expected：3 rows，每張表各一條 `policyname = 'Public read'`、`cmd = 'SELECT'`、`roles = '{anon,authenticated}'`。

- [ ] **Step 3: 無需 git commit**

這個 Task 沒有動到 repo 裡的任何檔案（migration 只存在 Supabase 的 migration history），跳過 commit。

---

### Task 2: Seed 既有硬編碼資料 + backfill 作品標籤 + 移除舊欄位

**Files:**
- 無本地檔案變更（同 Task 1，全部透過 Supabase MCP 工具操作 remote project）。

**Interfaces:**
- Consumes：Task 1 建立的三張表。
- Produces：`project_categories` 7 筆、`pricing_items` 8 筆、`project_tags` 為現有 31 筆作品的標籤關係；`projects` 表移除 `tags` 欄位（後續 Task 3 的 `getProjects()` 改寫依賴這個結果）。

- [ ] **Step 1: Seed `project_categories`（資料取自現有 `src/app/(sections)/Project.tsx` 硬編碼陣列，順序即 `order`）**

`mcp__supabase__apply_migration`，`name: "seed_project_categories"`：

```sql
insert into project_categories (title, description, "order") values
  ('社群專案', '粉絲專頁圖文設計', 0),
  ('廣告Banner', '廣告素材 / 電商圖片', 1),
  ('一頁式Landing page', '商品頁面 / 銷售頁面製作', 2),
  ('動畫製作', '簡易小動畫 / GIF', 3),
  ('插畫設計', '貼圖 / 吉祥物 / 自由創作作品', 4),
  ('視覺設計', 'LOGO設計 / 招牌設計 / 菜單設計 / 名片設計', 5),
  ('商品攝影', '商品拍攝後製 / 情境拍攝', 6);
```

- [ ] **Step 2: Seed `pricing_items`（資料取自現有 `src/app/(sections)/Pricing.tsx` 硬編碼陣列）**

`mcp__supabase__apply_migration`，`name: "seed_pricing_items"`：

```sql
insert into pricing_items (title, description, price, "order") values
  ('廣告Banner', '', 'NT$ 1,000-1,500', 0),
  ('社群圖片(FB/IG/LINE)', '素材設計單張價格，長期合作可議價', 'NT$ 800-1,200', 1),
  ('一頁式Landing page', '依照視覺複雜度與長度調整報價', 'NT$ 10,000-15,000', 2),
  ('EDM/菜單/DM', '不含印刷，如需統包另外加價', 'NT$ 1,000-1,500', 3),
  ('名片設計', '不含印刷，如需統包另外加價', 'NT$ 3,000', 4),
  ('LOGO設計', '僅含標誌圖像設計與建立品牌色，非CIS識別', 'NT$ 5,000', 5),
  ('簡易動畫製作', '視動畫難易度調整價格', 'NT$ 1,500起', 6),
  ('商品拍攝', '商品去背照/情境照', 'NT$ 500-800', 7);
```

- [ ] **Step 3: 驗證筆數**

`mcp__supabase__execute_sql`：

```sql
select
  (select count(*) from project_categories) as categories,
  (select count(*) from pricing_items) as pricing;
```

Expected：`categories = 7`、`pricing = 8`。

- [ ] **Step 4: Backfill `project_tags`（依現有 `projects.tags` 文字比對 `project_categories.title`）**

`mcp__supabase__apply_migration`，`name: "backfill_project_tags"`：

```sql
insert into project_tags (project_id, category_id)
select p.id, c.id
from projects p
cross join lateral unnest(p.tags) as t(tag)
join project_categories c on c.title = t.tag;
```

- [ ] **Step 5: 驗證 backfill 筆數一致（每個 tag 字串都要對應到一筆 project_tags）**

`mcp__supabase__execute_sql`：

```sql
select
  (select sum(array_length(tags, 1)) from projects where tags is not null and array_length(tags, 1) > 0) as tag_string_count,
  (select count(*) from project_tags) as project_tags_count;
```

Expected：兩個數字相等（實測資料應該是 62：31 筆作品 × 平均約 2 個標籤——實際數字以查詢結果為準，重點是兩欄相等）。如果不相等，先不要做 Step 6，回頭檢查是否有 tag 字串在 `project_categories.title` 找不到對應（可能是全形/半形或多餘空白差異），修正後重跑 Step 4。

- [ ] **Step 6: 確認無資料流失後，移除 `projects.tags` 欄位**

`mcp__supabase__apply_migration`，`name: "drop_projects_tags_column"`：

```sql
alter table projects drop column tags;
```

- [ ] **Step 7: 無需 git commit**

同 Task 1，全部是遠端資料庫操作，repo 沒有變更。

**⚠️ 注意：** Task 2 Step 6 之後，`src/lib/projects.ts` 的 `getProjects()`（還沒改）會讀不到 `tags` 欄位。Task 3 必須緊接著做，中間不要跑 `npm run build` 部署到 production。本機開發模式下讀取失敗只會讓作品的 `tags` 變成 `undefined`，不會 crash（`getProjects()` 有 try/catch 錯誤處理），但 `/projects` 頁面的標籤篩選跟首頁分類連結會暫時失效，屬於預期中的過渡狀態。

---

### Task 3: 資料層改寫 — `src/lib/projects.ts`

**Files:**
- Modify: `src/lib/projects.ts`（整份改寫）

**Interfaces:**
- Consumes：Task 2 建好的 `project_categories`、`project_tags`、`pricing_items` 表。
- Produces：
  - `type ProjectCategory = { id: string; title: string; description: string; order: number }`
  - `type ProjectCategoryWithUsage = ProjectCategory & { usageCount: number }`
  - `type PricingItem = { id: string; title: string; description: string; price: string; order: number }`
  - `getProjectCategories(): Promise<ProjectCategoryWithUsage[]>`
  - `getPricingItems(): Promise<PricingItem[]>`
  - `getProjects(): Promise<Project[]>`（型別不變，內部改用 join 組 `tags`）
  - `Project`、`ProjectImage`、`GroupLayoutType`、`deriveTags` 全部不變（供 Task 6 的 `ProjectGallery.tsx` 等現有消費者沿用，不用改那些檔案）。

- [ ] **Step 1: 改寫 `src/lib/projects.ts`**

```ts
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
```

- [ ] **Step 2: 型別檢查**

Run: `npx tsc --noEmit`
Expected：目前會報 `src/app/admin/actions.ts` 和 `src/app/admin/AdminDashboard.tsx` 用到舊的 `tags` 相關程式碼的錯誤（因為它們還沒改）——這是預期的，Task 4/5/7 會修。確認錯誤訊息都只集中在這兩個檔案，`src/lib/projects.ts` 本身沒有錯誤。

- [ ] **Step 3: Commit**

```bash
git add src/lib/projects.ts
git commit -m "feat: add category/pricing fetchers, join tags from project_tags"
```

---

### Task 4: Admin actions — 分類與定價的 CRUD + 排序

**Files:**
- Modify: `src/app/admin/actions.ts`

**Interfaces:**
- Consumes：`db()` from `src/lib/admin/supabaseAdmin.ts`、`requireSession()`（既有）。
- Produces：
  - `createCategoryAction(formData: FormData): Promise<void>`
  - `updateCategoryAction(id: string, formData: FormData): Promise<void>`
  - `deleteCategoryAction(id: string): Promise<void>`
  - `reorderCategoriesAction(orderedIds: string[]): Promise<void>`
  - `createPricingAction(formData: FormData): Promise<void>`
  - `updatePricingAction(id: string, formData: FormData): Promise<void>`
  - `deletePricingAction(id: string): Promise<void>`
  - `reorderPricingAction(orderedIds: string[]): Promise<void>`

  這些是 Task 9、10 的 `CategoriesTab.tsx` / `PricingTab.tsx` 要 import 的函式名稱，簽名要完全一致。

- [ ] **Step 1: 擴充 `revalidateAll()`，讓分類/定價的變更也會反映到首頁**

在 `src/app/admin/actions.ts` 找到：

```ts
function revalidateAll(): void {
  revalidatePath('/projects')
  revalidatePath('/admin')
}
```

改成：

```ts
function revalidateAll(): void {
  revalidatePath('/')
  revalidatePath('/projects')
  revalidatePath('/admin')
}
```

- [ ] **Step 2: 在 `revalidateAll()` 之後（原本 `// ---- CRUD ----` 區塊之前）新增分類 CRUD + reorder**

```ts
// ---- 分類 CRUD ----

export async function createCategoryAction(formData: FormData): Promise<void> {
  await requireSession()
  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  if (!title) throw new Error('分類標題必填')

  const { error } = await db().from('project_categories').insert({ title, description })
  if (error) throw new Error(error.message)
  revalidateAll()
}

export async function updateCategoryAction(id: string, formData: FormData): Promise<void> {
  await requireSession()
  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  if (!title) throw new Error('分類標題必填')

  const { error } = await db().from('project_categories').update({ title, description }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidateAll()
}

export async function deleteCategoryAction(id: string): Promise<void> {
  await requireSession()
  // DB FK cascade 會自動清掉 project_tags 裡引用這個分類的列
  const { error } = await db().from('project_categories').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidateAll()
}

export async function reorderCategoriesAction(orderedIds: string[]): Promise<void> {
  await requireSession()
  await Promise.all(
    orderedIds.map((id, i) => db().from('project_categories').update({ order: i }).eq('id', id))
  )
  revalidateAll()
}

// ---- 定價 CRUD ----

export async function createPricingAction(formData: FormData): Promise<void> {
  await requireSession()
  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const price = String(formData.get('price') ?? '').trim()
  if (!title) throw new Error('標題必填')
  if (!price) throw new Error('價錢必填')

  const { error } = await db().from('pricing_items').insert({ title, description, price })
  if (error) throw new Error(error.message)
  revalidateAll()
}

export async function updatePricingAction(id: string, formData: FormData): Promise<void> {
  await requireSession()
  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const price = String(formData.get('price') ?? '').trim()
  if (!title) throw new Error('標題必填')
  if (!price) throw new Error('價錢必填')

  const { error } = await db().from('pricing_items').update({ title, description, price }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidateAll()
}

export async function deletePricingAction(id: string): Promise<void> {
  await requireSession()
  const { error } = await db().from('pricing_items').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidateAll()
}

export async function reorderPricingAction(orderedIds: string[]): Promise<void> {
  await requireSession()
  await Promise.all(
    orderedIds.map((id, i) => db().from('pricing_items').update({ order: i }).eq('id', id))
  )
  revalidateAll()
}
```

- [ ] **Step 3: 型別檢查**

Run: `npx tsc --noEmit`
Expected：`actions.ts` 本身不再有新的錯誤（舊的 `createProjectAction`/`updateProjectAction` 因為還在用已刪除的 `tags` 解析邏輯，會在 Task 5 修）。

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/actions.ts
git commit -m "feat: add category and pricing CRUD/reorder server actions"
```

---

### Task 5: Admin actions — 作品標籤改成 `categoryIds` 多選

**Files:**
- Modify: `src/app/admin/actions.ts`

**Interfaces:**
- Consumes：Task 1 的 `project_tags` 表。
- Produces：`createProjectAction`、`updateProjectAction` 簽名不變（`(formData: FormData) => Promise<void>` / `(id: string, formData: FormData) => Promise<void>`），但內部讀取的欄位從 `tags`（逗號字串）改成 `categoryIds`（`formData.getAll('categoryIds')`，值是 `project_categories.id`）。Task 11 的 `ProjectForm` 要送出 `name="categoryIds"` 的多值欄位。

- [ ] **Step 1: 改寫 `parseFields` 與其型別，拿掉 `tags` 字串解析**

把：

```ts
type ParsedFields = {
  title: string
  description: string
  tags: string[]
  order: number
  type: 'single' | 'group'
  layout: string | null
}

function parseFields(formData: FormData): ParsedFields {
  const type = String(formData.get('type') ?? 'single') === 'group' ? 'group' : 'single'
  return {
    title: String(formData.get('title') ?? '').trim(),
    description: String(formData.get('description') ?? '').trim(),
    tags: String(formData.get('tags') ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean),
    order: Number.isFinite(Number(formData.get('order'))) ? Number(formData.get('order')) : 0,
    type,
    layout: type === 'group' ? String(formData.get('layout') ?? 'layout-1') : null
  }
}
```

改成：

```ts
type ParsedFields = {
  title: string
  description: string
  order: number
  type: 'single' | 'group'
  layout: string | null
}

function parseFields(formData: FormData): ParsedFields {
  const type = String(formData.get('type') ?? 'single') === 'group' ? 'group' : 'single'
  return {
    title: String(formData.get('title') ?? '').trim(),
    description: String(formData.get('description') ?? '').trim(),
    order: Number.isFinite(Number(formData.get('order'))) ? Number(formData.get('order')) : 0,
    type,
    layout: type === 'group' ? String(formData.get('layout') ?? 'layout-1') : null
  }
}

function parseCategoryIds(formData: FormData): string[] {
  return formData.getAll('categoryIds').map(String).filter(Boolean)
}

// create/update 共用：整組替換該作品的標籤關聯
async function setProjectTags(projectId: string, categoryIds: string[]): Promise<void> {
  const { error: delErr } = await db().from('project_tags').delete().eq('project_id', projectId)
  if (delErr) throw new Error(delErr.message)
  if (categoryIds.length === 0) return

  const { error: insErr } = await db()
    .from('project_tags')
    .insert(categoryIds.map(category_id => ({ project_id: projectId, category_id })))
  if (insErr) throw new Error(insErr.message)
}
```

- [ ] **Step 2: 改寫 `createProjectAction`**

把：

```ts
export async function createProjectAction(formData: FormData): Promise<void> {
  await requireSession()
  const fields = parseFields(formData)
  const files = getFiles(formData)
  assertCount(fields.type, files.length)

  const images = await uploadAllOrRollback(files)
  const { error } = await db().from('projects').insert({ ...fields, images })
  if (error) {
    await destroyImages(images.map(u => u.publicId)) // DB 失敗 → 回滾新上傳的圖
    throw new Error(error.message)
  }
  revalidateAll()
}
```

改成：

```ts
export async function createProjectAction(formData: FormData): Promise<void> {
  await requireSession()
  const fields = parseFields(formData)
  const categoryIds = parseCategoryIds(formData)
  const files = getFiles(formData)
  assertCount(fields.type, files.length)

  const images = await uploadAllOrRollback(files)
  const { data, error } = await db().from('projects').insert({ ...fields, images }).select('id').single()
  if (error) {
    await destroyImages(images.map(u => u.publicId)) // DB 失敗 → 回滾新上傳的圖
    throw new Error(error.message)
  }
  await setProjectTags(data.id, categoryIds)
  revalidateAll()
}
```

- [ ] **Step 3: 改寫 `updateProjectAction`**

把整個函式：

```ts
export async function updateProjectAction(id: string, formData: FormData): Promise<void> {
  await requireSession()
  const fields = parseFields(formData)
  const files = getFiles(formData)

  // 沒給新圖：只更新 metadata，images 不動
  if (files.length === 0) {
    const { error } = await db().from('projects').update(fields).eq('id', id)
    if (error) throw new Error(error.message)
    revalidateAll()
    return
  }

  // ponytail: 給了新圖 → 整組替換（非 plan 的逐圖 diff，但無孤兒：DB 成功後才刪舊圖）。
  // 要逐張替換 UI 再升級成 per-slot diff。
  assertCount(fields.type, files.length)
  const { data: old, error: readErr } = await db()
    .from('projects')
    .select('images')
    .eq('id', id)
    .single()
  if (readErr) throw new Error(readErr.message)

  const images = await uploadAllOrRollback(files)
  const { error } = await db().from('projects').update({ ...fields, images }).eq('id', id)
  if (error) {
    await destroyImages(images.map(u => u.publicId)) // DB 失敗 → 回滾新圖、保留舊圖
    throw new Error(error.message)
  }
  // DB 成功才刪舊圖
  const oldIds = ((old?.images ?? []) as UploadedImage[]).map(i => i.publicId)
  await destroyImages(oldIds)
  revalidateAll()
}
```

改成：

```ts
export async function updateProjectAction(id: string, formData: FormData): Promise<void> {
  await requireSession()
  const fields = parseFields(formData)
  const categoryIds = parseCategoryIds(formData)
  const files = getFiles(formData)

  // 沒給新圖：只更新 metadata，images 不動
  if (files.length === 0) {
    const { error } = await db().from('projects').update(fields).eq('id', id)
    if (error) throw new Error(error.message)
    await setProjectTags(id, categoryIds)
    revalidateAll()
    return
  }

  // ponytail: 給了新圖 → 整組替換（非 plan 的逐圖 diff，但無孤兒：DB 成功後才刪舊圖）。
  // 要逐張替換 UI 再升級成 per-slot diff。
  assertCount(fields.type, files.length)
  const { data: old, error: readErr } = await db()
    .from('projects')
    .select('images')
    .eq('id', id)
    .single()
  if (readErr) throw new Error(readErr.message)

  const images = await uploadAllOrRollback(files)
  const { error } = await db().from('projects').update({ ...fields, images }).eq('id', id)
  if (error) {
    await destroyImages(images.map(u => u.publicId)) // DB 失敗 → 回滾新圖、保留舊圖
    throw new Error(error.message)
  }
  await setProjectTags(id, categoryIds)
  // DB 成功才刪舊圖
  const oldIds = ((old?.images ?? []) as UploadedImage[]).map(i => i.publicId)
  await destroyImages(oldIds)
  revalidateAll()
}
```

`deleteProjectAction`、`reorderAction` 不用改（`project_tags` 靠 FK cascade 自動清掉）。

- [ ] **Step 4: 型別檢查**

Run: `npx tsc --noEmit`
Expected：`src/app/admin/actions.ts` 沒有錯誤。剩下的錯誤應該只在 `src/app/admin/AdminDashboard.tsx`（還在用舊的 `tags` Input，Task 7/11 會修）。

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/actions.ts
git commit -m "feat: rewrite project tag persistence to use category ids"
```

---

### Task 6: 前台 — Project、Pricing 區塊改資料庫驅動

**Files:**
- Modify: `src/app/(sections)/Project.tsx`
- Modify: `src/app/(sections)/Pricing.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes：`getProjectCategories()`、`getPricingItems()` from `src/lib/projects.ts`（Task 3）。

- [ ] **Step 1: 改寫 `src/app/(sections)/Project.tsx`**

```tsx
import Link from 'next/link'
import { getProjectCategories } from '@/lib/projects'

export default async function Project() {
  const categories = await getProjectCategories()

  return (
    <div id='project'>
      <div className='mb-8'>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src='/images/project.svg' alt='Project' />
      </div>
      <div className='project-list'>
        {categories.map(category => (
          <ProjectCard
            key={category.id}
            title={category.title}
            description={category.description}
            link={`/projects?tag=${encodeURIComponent(category.title)}`}
          />
        ))}
      </div>
    </div>
  )
}

function ProjectCard({
  title,
  description,
  link
}: {
  title: string
  description: string
  link: string
}) {
  return (
    <Link href={link} className='block'>
      <div className='project border-b-2 flex justify-between items-center py-3 md:py-6 cursor-pointer transition-opacity duration-200 ease-in-out-sine hover:opacity-100!'>
        <div className='flex flex-col md:flex-row items-baseline gap-2'>
          <div className='text-2xl font-bold'>{title}</div>
          <div className='text-sm text-light-gray'>{description}</div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className='w-8 arrow invisible transform -translate-x-4 transition-transform duration-400 ease-in-out'
          src='/images/arrow.svg'
          alt=''
        />
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: 改寫 `src/app/(sections)/Pricing.tsx`**

```tsx
import { getPricingItems } from '@/lib/projects'

export default async function Pricing() {
  const items = await getPricingItems()

  return (
    <div id='pricing'>
      <div className='mb-8'>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src='/images/pricing.svg' alt='Pricing' />
      </div>
      <div className='flex flex-col gap-4'>
        {items.map(item => (
          <PriceCard key={item.id} title={item.title} description={item.description} price={item.price} />
        ))}
      </div>
    </div>
  )
}

function PriceCard({
  title,
  description,
  price
}: {
  title: string
  description: string
  price: string
}) {
  return (
    <div className='border rounded-full flex justify-between items-center h-20 px-5'>
      <div className='flex flex-col md:flex-row gap-2 items-baseline'>
        <div className='font-bold md:text-2xl'>{title}</div>
        {description && <div className='text-xs md:text-sm text-light-gray'>{description}</div>}
      </div>
      <div className='font-bold md:text-2xl'>{price}</div>
    </div>
  )
}
```

- [ ] **Step 3: 幫首頁加 ISR revalidate**

在 `src/app/page.tsx` 的 imports 之後加一行（比照 `src/app/projects/page.tsx` 的作法）：

```tsx
import About from '@/app/(sections)/About'
import Contact from '@/app/(sections)/Contact'
import Hello from '@/app/(sections)/Hello'
import Pricing from '@/app/(sections)/Pricing'
import Project from '@/app/(sections)/Project'

// ISR：每小時最多重抓一次 DB，後台改分類/定價後最多等這麼久才會反映（也會被 admin action 的 revalidatePath('/') 立即刷新）
export const revalidate = 3600

export default function Home() {
```

- [ ] **Step 4: 型別檢查**

Run: `npx tsc --noEmit`
Expected：無錯誤。

- [ ] **Step 5: 瀏覽器驗證**

Run: `npm run dev`，開 `http://localhost:3000`。
Expected：首頁 Project 區塊顯示 7 張分類卡片（文字跟改版前一致），點其中一張連到 `/projects?tag=...` 且該分類的作品有正常顯示；Pricing 區塊顯示 8 筆定價卡片，文字跟改版前一致。

- [ ] **Step 6: Commit**

```bash
git add "src/app/(sections)/Project.tsx" "src/app/(sections)/Pricing.tsx" src/app/page.tsx
git commit -m "feat: drive homepage Project/Pricing sections from the database"
```

---

### Task 7: Admin Tabs 外殼 + 抽出 `ProjectsTab.tsx`（純搬移，行為不變）

**Files:**
- Create: `src/components/ui/tabs.tsx`（`shadcn` 產生）
- Create: `src/app/admin/ProjectsTab.tsx`
- Modify: `src/app/admin/AdminDashboard.tsx`
- Modify: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes：`getProjectCategories()`、`getPricingItems()`（Task 3，這個 Task 先把資料傳下去，UI 還不用，Task 9/10/11 才用）。
- Produces：`ProjectsTab` component，props `{ initialProjects: Project[] }`（跟現在 `AdminDashboard` 的 props 一樣，先原封不動搬過去）。`AdminDashboard` 的 props 變成 `{ initialProjects: Project[]; initialCategories: ProjectCategoryWithUsage[]; initialPricing: PricingItem[] }`。

- [ ] **Step 1: 加入 Tabs UI 元件**

Run:
```bash
npx shadcn@latest add tabs
```
Expected：產生 `src/components/ui/tabs.tsx`，內容用 `@base-ui/react/tabs`，`TabsList` 支援 `variant: 'default' | 'line'`。如果指令因為互動式 prompt 卡住，改用 `npx shadcn@latest add tabs --yes` 或直接手動建立 `src/components/ui/tabs.tsx`，內容如下（跟 registry 產出一致，只是把 import 路徑換成本專案慣例）：

```tsx
"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:text-muted-foreground dark:hover:text-foreground group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "data-active:bg-background data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-foreground",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
```

- [ ] **Step 2: 建立 `src/app/admin/ProjectsTab.tsx`，把現有 `AdminDashboard.tsx` 除了外層 header/logout 之外的內容整個搬過去**

把現在 `src/app/admin/AdminDashboard.tsx` 第 37–328 行（`export default function AdminDashboard` 到檔案結尾，扣掉 header 那段 `<h1>`/登出 `<form>`）搬到新檔案，函式改名成 `ProjectsTab`：

```tsx
'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Reorder, useDragControls } from 'framer-motion'
import { type Project } from '@/lib/projects'
import {
  createProjectAction,
  updateProjectAction,
  deleteProjectAction,
  reorderAction
} from './actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog'

const thumb = (url: string) =>
  url.includes('/upload/') ? url.replace('/upload/', '/upload/w_200,c_limit,f_auto,q_auto/') : url

export default function ProjectsTab({ initialProjects }: { initialProjects: Project[] }) {
  const router = useRouter()
  const [items, setItems] = useState(initialProjects)
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const itemsRef = useRef(items)
  itemsRef.current = items

  // server 重新驗證後同步最新資料
  useEffect(() => setItems(initialProjects), [initialProjects])

  const refresh = () => router.refresh()

  // 拖曳過程只更新畫面順序，放手才寫回 server（避免每次交換都打 API）
  const persistOrder = () => {
    reorderAction(itemsRef.current.map(p => p.id)).then(refresh)
  }

  return (
    <div>
      <div className='mb-8'>
        {creating ? (
          <Card>
            <CardContent>
              <ProjectForm
                onCancel={() => setCreating(false)}
                onSubmit={async fd => {
                  await createProjectAction(fd)
                  setCreating(false)
                  refresh()
                }}
              />
            </CardContent>
          </Card>
        ) : (
          <Button onClick={() => setCreating(true)} className='rounded-full'>
            + 新增專案
          </Button>
        )}
      </div>

      <Reorder.Group as='ul' axis='y' values={items} onReorder={setItems} className='flex flex-col gap-3'>
        {items.map(p => (
          <ProjectItem
            key={p.id}
            project={p}
            editing={editing === p.id}
            onToggleEdit={() => setEditing(editing === p.id ? null : p.id)}
            onDragEnd={persistOrder}
            onDone={refresh}
            onSubmit={async fd => {
              await updateProjectAction(p.id, fd)
              setEditing(null)
              refresh()
            }}
          />
        ))}
      </Reorder.Group>
    </div>
  )
}

function ProjectItem({
  project: p,
  editing,
  onToggleEdit,
  onDragEnd,
  onDone,
  onSubmit
}: {
  project: Project
  editing: boolean
  onToggleEdit: () => void
  onDragEnd: () => void
  onDone: () => void
  onSubmit: (fd: FormData) => Promise<void>
}) {
  const dragControls = useDragControls()

  return (
    <Reorder.Item
      value={p}
      as='li'
      dragListener={false}
      dragControls={dragControls}
      onDragEnd={onDragEnd}
      whileDrag={{ scale: 1.02, boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
      <Card>
        <CardContent>
          <div className='flex items-center gap-4'>
            <span
              onPointerDown={e => dragControls.start(e)}
              className='cursor-grab touch-none select-none text-muted-foreground'
              title='拖曳排序'>
              ⠿
            </span>
            {p.images[0] && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={thumb(p.images[0].url)} alt='' className='h-16 w-16 shrink-0 rounded object-cover' />
            )}
            <div className='min-w-0 flex-1'>
              <div className='truncate font-bold'>{p.title || '（無標題）'}</div>
              <div className='mt-1 flex flex-wrap items-center gap-1.5'>
                <Badge variant='secondary'>{p.type}</Badge>
                {p.layout && <Badge variant='outline'>{p.layout}</Badge>}
                <span className='truncate text-sm text-muted-foreground'>
                  {p.images.length} 圖 · {p.tags.join(', ')}
                </span>
              </div>
            </div>
            <Button variant='outline' size='sm' onClick={onToggleEdit}>
              {editing ? '關閉' : '編輯'}
            </Button>
            <DeleteButton id={p.id} onDone={onDone} />
          </div>

          {editing && (
            <div className='mt-4 border-t pt-4'>
              <ProjectForm project={p} onCancel={onToggleEdit} onSubmit={onSubmit} />
            </div>
          )}
        </CardContent>
      </Card>
    </Reorder.Item>
  )
}

function DeleteButton({ id, onDone }: { id: string; onDone: () => void }) {
  const [pending, start] = useTransition()
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button variant='destructive' size='sm' disabled={pending}>
            刪除
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>確定刪除？</AlertDialogTitle>
          <AlertDialogDescription>圖片會一併從 Cloudinary 清除，此操作無法復原。</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            variant='destructive'
            onClick={() => start(async () => {
              await deleteProjectAction(id)
              onDone()
            })}>
            刪除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function ProjectForm({
  project,
  onSubmit,
  onCancel
}: {
  project?: Project
  onSubmit: (fd: FormData) => Promise<void>
  onCancel: () => void
}) {
  const [type, setType] = useState<'single' | 'group'>(project?.type === 'group' ? 'group' : 'single')
  const [layout, setLayout] = useState(project?.layout ?? 'layout-1')
  const [previews, setPreviews] = useState<string[]>([])
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  const need = type === 'single' ? 1 : 4

  return (
    <form
      ref={formRef}
      onSubmit={e => {
        e.preventDefault()
        setError('')
        const fd = new FormData(e.currentTarget)
        fd.set('type', type)
        fd.set('layout', layout)
        start(async () => {
          try {
            await onSubmit(fd)
          } catch (err) {
            setError(err instanceof Error ? err.message : '操作失敗')
          }
        })
      }}
      className='flex flex-col gap-3'>
      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
        <div className='flex flex-col gap-2'>
          <Label htmlFor='title'>標題</Label>
          <Input id='title' name='title' defaultValue={project?.title} placeholder='標題' />
        </div>
        <div className='flex flex-col gap-2'>
          <Label htmlFor='order'>順序</Label>
          <Input id='order' name='order' type='number' defaultValue={project?.order ?? 0} placeholder='順序' />
        </div>
      </div>
      <div className='flex flex-col gap-2'>
        <Label htmlFor='description'>說明</Label>
        <Textarea id='description' name='description' defaultValue={project?.description} placeholder='說明' />
      </div>
      <div className='flex flex-col gap-2'>
        <Label htmlFor='tags'>標籤</Label>
        <Input id='tags' name='tags' defaultValue={project?.tags.join(', ')} placeholder='標籤（用逗號分隔）' />
      </div>
      <div className='flex gap-3'>
        <div className='flex flex-col gap-2'>
          <Label>類型</Label>
          <Select value={type} onValueChange={v => setType(v as 'single' | 'group')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='single'>single（單圖）</SelectItem>
              <SelectItem value='group'>group（四圖）</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {type === 'group' && (
          <div className='flex flex-col gap-2'>
            <Label>版型</Label>
            <Select value={layout} onValueChange={v => v && setLayout(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='layout-1'>layout-1（2×2）</SelectItem>
                <SelectItem value='layout-2'>layout-2（上大下三）</SelectItem>
                <SelectItem value='layout-3'>layout-3（左大右三）</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className='flex flex-col gap-2'>
        <Label htmlFor='files'>
          圖片（需 {need} 張{project ? '；留空＝不更換現有圖片' : ''}）
        </Label>
        <Input
          id='files'
          name='files'
          type='file'
          multiple
          accept='image/jpeg,image/png,image/webp,image/avif'
          onChange={e => setPreviews(Array.from(e.target.files ?? []).map(f => URL.createObjectURL(f)))}
        />
      </div>

      {(previews.length > 0 ? previews : project?.images.map(i => thumb(i.url)) ?? []).length > 0 && (
        <div className='flex flex-wrap gap-2'>
          {(previews.length > 0 ? previews : project!.images.map(i => thumb(i.url))).map((src, i) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img key={i} src={src} alt='' className='h-20 w-20 rounded object-cover' />
          ))}
        </div>
      )}

      {error && (
        <Alert variant='destructive'>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className='flex gap-2'>
        <Button type='submit' disabled={pending} className='rounded-full'>
          {pending ? '處理中…' : project ? '儲存' : '建立'}
        </Button>
        <Button type='button' variant='outline' onClick={onCancel} className='rounded-full'>
          取消
        </Button>
      </div>
    </form>
  )
}
```

（跟原檔案唯一的差異：函式名稱 `AdminDashboard` → `ProjectsTab`，最外層 `<div className='mx-auto max-w-5xl px-4 py-10'>` 連同 header/登出 `<form>` 拿掉，換成單純的 `<div>`。其他程式碼逐字搬移，`tags` 欄位這步先保持逗號字串 Input 不變——Task 11 才會換成多選。）

- [ ] **Step 3: 改寫 `src/app/admin/AdminDashboard.tsx` 成 Tabs 外殼**

```tsx
'use client'

import { useState } from 'react'
import { type Project, type ProjectCategoryWithUsage, type PricingItem } from '@/lib/projects'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { logoutAction } from './actions'
import { Button } from '@/components/ui/button'
import ProjectsTab from './ProjectsTab'

export default function AdminDashboard({
  initialProjects,
  initialCategories,
  initialPricing
}: {
  initialProjects: Project[]
  initialCategories: ProjectCategoryWithUsage[]
  initialPricing: PricingItem[]
}) {
  const [tab, setTab] = useState('projects')

  return (
    <div className='mx-auto max-w-5xl px-4 py-10'>
      <div className='mb-8 flex items-center justify-between'>
        <h1 className='text-3xl font-bold'>作品後台</h1>
        <form action={logoutAction}>
          <Button type='submit' variant='outline' className='rounded-full'>
            登出
          </Button>
        </form>
      </div>

      <Tabs value={tab} onValueChange={value => setTab(String(value))}>
        <TabsList variant='line' className='mb-8'>
          <TabsTrigger value='projects'>作品</TabsTrigger>
          <TabsTrigger value='categories'>分類</TabsTrigger>
          <TabsTrigger value='pricing'>定價</TabsTrigger>
        </TabsList>
        <TabsContent value='projects'>
          <ProjectsTab initialProjects={initialProjects} />
        </TabsContent>
        <TabsContent value='categories'>
          {/* Task 9 補上 CategoriesTab */}
          <p className='text-sm text-muted-foreground'>{initialCategories.length} 個分類（Task 9 完成後這裡會換成完整管理介面）</p>
        </TabsContent>
        <TabsContent value='pricing'>
          {/* Task 10 補上 PricingTab */}
          <p className='text-sm text-muted-foreground'>{initialPricing.length} 筆定價（Task 10 完成後這裡會換成完整管理介面）</p>
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 4: 改寫 `src/app/admin/page.tsx`，撈齊三份資料**

```tsx
import { getProjects, getProjectCategories, getPricingItems } from '@/lib/projects'
import AdminDashboard from './AdminDashboard'

// 後台一律即時讀取，不快取
export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const [projects, categories, pricing] = await Promise.all([
    getProjects(),
    getProjectCategories(),
    getPricingItems()
  ])
  return <AdminDashboard initialProjects={projects} initialCategories={categories} initialPricing={pricing} />
}
```

- [ ] **Step 5: 型別檢查**

Run: `npx tsc --noEmit`
Expected：無錯誤。

- [ ] **Step 6: 瀏覽器驗證**

Run: `npm run dev`，登入 `/admin`。
Expected：看到「作品 / 分類 / 定價」三個 line-style tabs；「作品」tab 底下的功能（新增、編輯、拖曳排序、刪除）跟改版前完全一樣；「分類」「分價」tab 顯示暫時的筆數文字；登出按鈕仍正常運作（回到前台首頁）。

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/tabs.tsx src/app/admin/ProjectsTab.tsx src/app/admin/AdminDashboard.tsx src/app/admin/page.tsx
git commit -m "refactor: split AdminDashboard into tabs shell + ProjectsTab"
```

---

### Task 8: 抽出共用拖曳排序 hook

**Files:**
- Create: `src/app/admin/useReorderList.ts`
- Modify: `src/app/admin/ProjectsTab.tsx`

**Interfaces:**
- Produces：`useReorderList<T extends { id: string }>(initialItems: T[], reorderAction: (orderedIds: string[]) => Promise<void>, onReordered: () => void): { items: T[]; setItems: (items: T[]) => void; persistOrder: () => void }`。Task 9、10 的 `CategoriesTab`/`PricingTab` 要 import 這個 hook。

- [ ] **Step 1: 建立 `src/app/admin/useReorderList.ts`**

```ts
'use client'

import { useEffect, useRef, useState } from 'react'

// 拖曳過程只更新畫面順序，放手才寫回 server（避免每次交換都打 API）
export function useReorderList<T extends { id: string }>(
  initialItems: T[],
  reorderAction: (orderedIds: string[]) => Promise<void>,
  onReordered: () => void
) {
  const [items, setItems] = useState(initialItems)
  const itemsRef = useRef(items)
  itemsRef.current = items

  // server 重新驗證後同步最新資料
  useEffect(() => setItems(initialItems), [initialItems])

  const persistOrder = () => {
    reorderAction(itemsRef.current.map(item => item.id)).then(onReordered)
  }

  return { items, setItems, persistOrder }
}
```

- [ ] **Step 2: 改 `src/app/admin/ProjectsTab.tsx` 用這個 hook**

把：

```ts
import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
```

改成：

```ts
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
```

加上：

```ts
import { useReorderList } from './useReorderList'
```

把 `ProjectsTab` 函式內的：

```ts
export default function ProjectsTab({ initialProjects }: { initialProjects: Project[] }) {
  const router = useRouter()
  const [items, setItems] = useState(initialProjects)
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const itemsRef = useRef(items)
  itemsRef.current = items

  // server 重新驗證後同步最新資料
  useEffect(() => setItems(initialProjects), [initialProjects])

  const refresh = () => router.refresh()

  // 拖曳過程只更新畫面順序，放手才寫回 server（避免每次交換都打 API）
  const persistOrder = () => {
    reorderAction(itemsRef.current.map(p => p.id)).then(refresh)
  }
```

改成：

```ts
export default function ProjectsTab({ initialProjects }: { initialProjects: Project[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const refresh = () => router.refresh()
  const { items, setItems, persistOrder } = useReorderList(initialProjects, reorderAction, refresh)
```

- [ ] **Step 3: 型別檢查**

Run: `npx tsc --noEmit`
Expected：無錯誤。

- [ ] **Step 4: 瀏覽器驗證**

Run: `npm run dev`，在「作品」tab 拖曳一筆作品換順序、放手，重新整理頁面確認順序有存住。
Expected：跟 Task 7 Step 6 驗證的行為完全一樣（這步是純內部重構，不應該有任何可觀察的行為變化）。

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/useReorderList.ts src/app/admin/ProjectsTab.tsx
git commit -m "refactor: extract useReorderList hook from ProjectsTab"
```

---

### Task 9: `CategoriesTab.tsx` — 分類 CRUD + 拖曳排序 + 刪除確認

**Files:**
- Create: `src/app/admin/CategoriesTab.tsx`
- Modify: `src/app/admin/AdminDashboard.tsx`

**Interfaces:**
- Consumes：`useReorderList`（Task 8）、`createCategoryAction`/`updateCategoryAction`/`deleteCategoryAction`/`reorderCategoriesAction`（Task 4）、`ProjectCategoryWithUsage`（Task 3）。
- Produces：`CategoriesTab` component，props `{ initialCategories: ProjectCategoryWithUsage[] }`。

- [ ] **Step 1: 建立 `src/app/admin/CategoriesTab.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Reorder, useDragControls } from 'framer-motion'
import { type ProjectCategoryWithUsage } from '@/lib/projects'
import {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
  reorderCategoriesAction
} from './actions'
import { useReorderList } from './useReorderList'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog'

export default function CategoriesTab({ initialCategories }: { initialCategories: ProjectCategoryWithUsage[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const refresh = () => router.refresh()
  const { items, setItems, persistOrder } = useReorderList(initialCategories, reorderCategoriesAction, refresh)

  return (
    <div>
      <div className='mb-8'>
        {creating ? (
          <Card>
            <CardContent>
              <CategoryForm
                onCancel={() => setCreating(false)}
                onSubmit={async fd => {
                  await createCategoryAction(fd)
                  setCreating(false)
                  refresh()
                }}
              />
            </CardContent>
          </Card>
        ) : (
          <Button onClick={() => setCreating(true)} className='rounded-full'>
            + 新增分類
          </Button>
        )}
      </div>

      <Reorder.Group as='ul' axis='y' values={items} onReorder={setItems} className='flex flex-col gap-3'>
        {items.map(category => (
          <CategoryItem
            key={category.id}
            category={category}
            editing={editing === category.id}
            onToggleEdit={() => setEditing(editing === category.id ? null : category.id)}
            onDragEnd={persistOrder}
            onDone={refresh}
            onSubmit={async fd => {
              await updateCategoryAction(category.id, fd)
              setEditing(null)
              refresh()
            }}
          />
        ))}
      </Reorder.Group>
    </div>
  )
}

function CategoryItem({
  category,
  editing,
  onToggleEdit,
  onDragEnd,
  onDone,
  onSubmit
}: {
  category: ProjectCategoryWithUsage
  editing: boolean
  onToggleEdit: () => void
  onDragEnd: () => void
  onDone: () => void
  onSubmit: (fd: FormData) => Promise<void>
}) {
  const dragControls = useDragControls()

  return (
    <Reorder.Item
      value={category}
      as='li'
      dragListener={false}
      dragControls={dragControls}
      onDragEnd={onDragEnd}
      whileDrag={{ scale: 1.02, boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
      <Card>
        <CardContent>
          <div className='flex items-center gap-4'>
            <span
              onPointerDown={e => dragControls.start(e)}
              className='cursor-grab touch-none select-none text-muted-foreground'
              title='拖曳排序'>
              ⠿
            </span>
            <div className='min-w-0 flex-1'>
              <div className='truncate font-bold'>{category.title}</div>
              <div className='truncate text-sm text-muted-foreground'>
                {category.description || '（無說明）'} · {category.usageCount} 個作品使用
              </div>
            </div>
            <Button variant='outline' size='sm' onClick={onToggleEdit}>
              {editing ? '關閉' : '編輯'}
            </Button>
            <DeleteCategoryButton category={category} onDone={onDone} />
          </div>

          {editing && (
            <div className='mt-4 border-t pt-4'>
              <CategoryForm category={category} onCancel={onToggleEdit} onSubmit={onSubmit} />
            </div>
          )}
        </CardContent>
      </Card>
    </Reorder.Item>
  )
}

function DeleteCategoryButton({
  category,
  onDone
}: {
  category: ProjectCategoryWithUsage
  onDone: () => void
}) {
  const [pending, start] = useTransition()
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button variant='destructive' size='sm' disabled={pending}>
            刪除
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>確定刪除「{category.title}」？</AlertDialogTitle>
          <AlertDialogDescription>
            {category.usageCount > 0
              ? `有 ${category.usageCount} 個作品使用此標籤，刪除後將一併移除，此操作無法復原。`
              : '此操作無法復原。'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            variant='destructive'
            onClick={() => start(async () => {
              await deleteCategoryAction(category.id)
              onDone()
            })}>
            刪除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function CategoryForm({
  category,
  onSubmit,
  onCancel
}: {
  category?: ProjectCategoryWithUsage
  onSubmit: (fd: FormData) => Promise<void>
  onCancel: () => void
}) {
  const [error, setError] = useState('')
  const [pending, start] = useTransition()

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        setError('')
        const fd = new FormData(e.currentTarget)
        start(async () => {
          try {
            await onSubmit(fd)
          } catch (err) {
            setError(err instanceof Error ? err.message : '操作失敗')
          }
        })
      }}
      className='flex flex-col gap-3'>
      <div className='flex flex-col gap-2'>
        <Label htmlFor='title'>標題</Label>
        <Input id='title' name='title' defaultValue={category?.title} placeholder='標題' />
      </div>
      <div className='flex flex-col gap-2'>
        <Label htmlFor='description'>說明</Label>
        <Textarea id='description' name='description' defaultValue={category?.description} placeholder='說明' />
      </div>

      {error && (
        <Alert variant='destructive'>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className='flex gap-2'>
        <Button type='submit' disabled={pending} className='rounded-full'>
          {pending ? '處理中…' : category ? '儲存' : '建立'}
        </Button>
        <Button type='button' variant='outline' onClick={onCancel} className='rounded-full'>
          取消
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: 接進 `AdminDashboard.tsx`**

把：

```tsx
import ProjectsTab from './ProjectsTab'
```

改成：

```tsx
import ProjectsTab from './ProjectsTab'
import CategoriesTab from './CategoriesTab'
```

把：

```tsx
        <TabsContent value='categories'>
          {/* Task 9 補上 CategoriesTab */}
          <p className='text-sm text-muted-foreground'>{initialCategories.length} 個分類（Task 9 完成後這裡會換成完整管理介面）</p>
        </TabsContent>
```

改成：

```tsx
        <TabsContent value='categories'>
          <CategoriesTab initialCategories={initialCategories} />
        </TabsContent>
```

- [ ] **Step 3: 型別檢查**

Run: `npx tsc --noEmit`
Expected：無錯誤。

- [ ] **Step 4: 瀏覽器驗證**

Run: `npm run dev`，切到「分類」tab。
Expected：看到 7 筆分類，每筆顯示標題/說明/使用中的作品數；新增一筆分類存檔後出現在列表；編輯一筆分類的標題存檔後即時更新；拖曳排序後重新整理順序有保留；刪除一筆「使用中」的分類（例如「商品攝影」）時，確認視窗顯示正確的受影響作品數，確認後該分類消失，回「作品」tab 檢查原本套用該標籤的作品標籤已經被移除；刪除一筆全新、沒有作品使用的分類時，確認視窗文字是「此操作無法復原。」（沒有受影響數量那句）。

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/CategoriesTab.tsx src/app/admin/AdminDashboard.tsx
git commit -m "feat: add CategoriesTab with CRUD, reorder, and cascade-delete confirm"
```

---

### Task 10: `PricingTab.tsx` — 定價 CRUD + 拖曳排序

**Files:**
- Create: `src/app/admin/PricingTab.tsx`
- Modify: `src/app/admin/AdminDashboard.tsx`

**Interfaces:**
- Consumes：`useReorderList`（Task 8）、`createPricingAction`/`updatePricingAction`/`deletePricingAction`/`reorderPricingAction`（Task 4）、`PricingItem`（Task 3）。
- Produces：`PricingTab` component，props `{ initialPricing: PricingItem[] }`。

- [ ] **Step 1: 建立 `src/app/admin/PricingTab.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Reorder, useDragControls } from 'framer-motion'
import { type PricingItem } from '@/lib/projects'
import {
  createPricingAction,
  updatePricingAction,
  deletePricingAction,
  reorderPricingAction
} from './actions'
import { useReorderList } from './useReorderList'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog'

export default function PricingTab({ initialPricing }: { initialPricing: PricingItem[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const refresh = () => router.refresh()
  const { items, setItems, persistOrder } = useReorderList(initialPricing, reorderPricingAction, refresh)

  return (
    <div>
      <div className='mb-8'>
        {creating ? (
          <Card>
            <CardContent>
              <PricingForm
                onCancel={() => setCreating(false)}
                onSubmit={async fd => {
                  await createPricingAction(fd)
                  setCreating(false)
                  refresh()
                }}
              />
            </CardContent>
          </Card>
        ) : (
          <Button onClick={() => setCreating(true)} className='rounded-full'>
            + 新增定價
          </Button>
        )}
      </div>

      <Reorder.Group as='ul' axis='y' values={items} onReorder={setItems} className='flex flex-col gap-3'>
        {items.map(item => (
          <PricingListItem
            key={item.id}
            item={item}
            editing={editing === item.id}
            onToggleEdit={() => setEditing(editing === item.id ? null : item.id)}
            onDragEnd={persistOrder}
            onDone={refresh}
            onSubmit={async fd => {
              await updatePricingAction(item.id, fd)
              setEditing(null)
              refresh()
            }}
          />
        ))}
      </Reorder.Group>
    </div>
  )
}

function PricingListItem({
  item,
  editing,
  onToggleEdit,
  onDragEnd,
  onDone,
  onSubmit
}: {
  item: PricingItem
  editing: boolean
  onToggleEdit: () => void
  onDragEnd: () => void
  onDone: () => void
  onSubmit: (fd: FormData) => Promise<void>
}) {
  const dragControls = useDragControls()

  return (
    <Reorder.Item
      value={item}
      as='li'
      dragListener={false}
      dragControls={dragControls}
      onDragEnd={onDragEnd}
      whileDrag={{ scale: 1.02, boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
      <Card>
        <CardContent>
          <div className='flex items-center gap-4'>
            <span
              onPointerDown={e => dragControls.start(e)}
              className='cursor-grab touch-none select-none text-muted-foreground'
              title='拖曳排序'>
              ⠿
            </span>
            <div className='min-w-0 flex-1'>
              <div className='truncate font-bold'>{item.title}</div>
              <div className='truncate text-sm text-muted-foreground'>
                {item.price} {item.description && `· ${item.description}`}
              </div>
            </div>
            <Button variant='outline' size='sm' onClick={onToggleEdit}>
              {editing ? '關閉' : '編輯'}
            </Button>
            <DeletePricingButton id={item.id} onDone={onDone} />
          </div>

          {editing && (
            <div className='mt-4 border-t pt-4'>
              <PricingForm item={item} onCancel={onToggleEdit} onSubmit={onSubmit} />
            </div>
          )}
        </CardContent>
      </Card>
    </Reorder.Item>
  )
}

function DeletePricingButton({ id, onDone }: { id: string; onDone: () => void }) {
  const [pending, start] = useTransition()
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button variant='destructive' size='sm' disabled={pending}>
            刪除
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>確定刪除？</AlertDialogTitle>
          <AlertDialogDescription>此操作無法復原。</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            variant='destructive'
            onClick={() => start(async () => {
              await deletePricingAction(id)
              onDone()
            })}>
            刪除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function PricingForm({
  item,
  onSubmit,
  onCancel
}: {
  item?: PricingItem
  onSubmit: (fd: FormData) => Promise<void>
  onCancel: () => void
}) {
  const [error, setError] = useState('')
  const [pending, start] = useTransition()

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        setError('')
        const fd = new FormData(e.currentTarget)
        start(async () => {
          try {
            await onSubmit(fd)
          } catch (err) {
            setError(err instanceof Error ? err.message : '操作失敗')
          }
        })
      }}
      className='flex flex-col gap-3'>
      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
        <div className='flex flex-col gap-2'>
          <Label htmlFor='title'>標題</Label>
          <Input id='title' name='title' defaultValue={item?.title} placeholder='標題' />
        </div>
        <div className='flex flex-col gap-2'>
          <Label htmlFor='price'>價錢</Label>
          <Input id='price' name='price' defaultValue={item?.price} placeholder='例如 NT$ 1,000-1,500' />
        </div>
      </div>
      <div className='flex flex-col gap-2'>
        <Label htmlFor='description'>說明（可留空）</Label>
        <Textarea id='description' name='description' defaultValue={item?.description} placeholder='說明' />
      </div>

      {error && (
        <Alert variant='destructive'>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className='flex gap-2'>
        <Button type='submit' disabled={pending} className='rounded-full'>
          {pending ? '處理中…' : item ? '儲存' : '建立'}
        </Button>
        <Button type='button' variant='outline' onClick={onCancel} className='rounded-full'>
          取消
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: 接進 `AdminDashboard.tsx`**

把：

```tsx
import CategoriesTab from './CategoriesTab'
```

改成：

```tsx
import CategoriesTab from './CategoriesTab'
import PricingTab from './PricingTab'
```

把：

```tsx
        <TabsContent value='pricing'>
          {/* Task 10 補上 PricingTab */}
          <p className='text-sm text-muted-foreground'>{initialPricing.length} 筆定價（Task 10 完成後這裡會換成完整管理介面）</p>
        </TabsContent>
```

改成：

```tsx
        <TabsContent value='pricing'>
          <PricingTab initialPricing={initialPricing} />
        </TabsContent>
```

- [ ] **Step 3: 型別檢查**

Run: `npx tsc --noEmit`
Expected：無錯誤。

- [ ] **Step 4: 瀏覽器驗證**

Run: `npm run dev`，切到「定價」tab。
Expected：看到 8 筆定價項目；新增（含空說明）、編輯、拖曳排序、刪除都正常；空說明存檔後前台 Pricing 卡片不顯示說明那行（跟改版前 `{description && ...}` 的行為一致）。

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/PricingTab.tsx src/app/admin/AdminDashboard.tsx
git commit -m "feat: add PricingTab with CRUD and reorder"
```

---

### Task 11: 作品標籤改成多選 `Select`，補上「標籤未設定」提示

**Files:**
- Modify: `src/app/admin/ProjectsTab.tsx`
- Modify: `src/app/admin/AdminDashboard.tsx`
- Modify: `src/app/admin/page.tsx`（確認 Task 7 已經傳好 `initialCategories`，這步只需要再往下傳給 `ProjectsTab`）

**Interfaces:**
- Consumes：`ProjectCategoryWithUsage[]`（Task 3）、`@base-ui/react/select` 的 `multiple` 模式（Select 根元件原生支援，`name` prop 會自動產生多個 hidden input）。
- Produces：`ProjectsTab` props 變成 `{ initialProjects: Project[]; categories: ProjectCategoryWithUsage[] }`。

- [ ] **Step 1: `AdminDashboard.tsx` 把 `categories` 傳給 `ProjectsTab`**

把：

```tsx
        <TabsContent value='projects'>
          <ProjectsTab initialProjects={initialProjects} />
        </TabsContent>
```

改成：

```tsx
        <TabsContent value='projects'>
          <ProjectsTab initialProjects={initialProjects} categories={initialCategories} />
        </TabsContent>
```

- [ ] **Step 2: `ProjectsTab.tsx` 接收 `categories` prop，往下傳給 `ProjectForm`**

把：

```tsx
import { type Project } from '@/lib/projects'
```

改成：

```tsx
import { type Project, type ProjectCategoryWithUsage } from '@/lib/projects'
```

把：

```tsx
export default function ProjectsTab({ initialProjects }: { initialProjects: Project[] }) {
```

改成：

```tsx
export default function ProjectsTab({
  initialProjects,
  categories
}: {
  initialProjects: Project[]
  categories: ProjectCategoryWithUsage[]
}) {
```

把 `ProjectItem` 呼叫 `ProjectForm` 的地方（`onSubmit` 那個 `<ProjectForm project={p} onCancel={onToggleEdit} onSubmit={onSubmit} />`）跟新增用的 `<ProjectForm onCancel={...} onSubmit={...} />` 都加上 `categories={categories}`：

```tsx
              <ProjectForm
                categories={categories}
                onCancel={() => setCreating(false)}
                onSubmit={async fd => {
                  await createProjectAction(fd)
                  setCreating(false)
                  refresh()
                }}
              />
```

```tsx
              <ProjectForm project={p} categories={categories} onCancel={onToggleEdit} onSubmit={onSubmit} />
```

同時 `ProjectItem` 的 props type 要加 `categories: ProjectCategoryWithUsage[]`，並在 `items.map(p => (<ProjectItem ... />))` 那裡把 `categories={categories}` 傳進去：

```tsx
function ProjectItem({
  project: p,
  categories,
  editing,
  onToggleEdit,
  onDragEnd,
  onDone,
  onSubmit
}: {
  project: Project
  categories: ProjectCategoryWithUsage[]
  editing: boolean
  onToggleEdit: () => void
  onDragEnd: () => void
  onDone: () => void
  onSubmit: (fd: FormData) => Promise<void>
}) {
```

```tsx
        {items.map(p => (
          <ProjectItem
            key={p.id}
            project={p}
            categories={categories}
            editing={editing === p.id}
            onToggleEdit={() => setEditing(editing === p.id ? null : p.id)}
            onDragEnd={persistOrder}
            onDone={refresh}
            onSubmit={async fd => {
              await updateProjectAction(p.id, fd)
              setEditing(null)
              refresh()
            }}
          />
        ))}
```

- [ ] **Step 3: `ProjectForm` 把 `tags` 逗號字串 Input 換成多選 `Select`**

把：

```tsx
function ProjectForm({
  project,
  onSubmit,
  onCancel
}: {
  project?: Project
  onSubmit: (fd: FormData) => Promise<void>
  onCancel: () => void
}) {
  const [type, setType] = useState<'single' | 'group'>(project?.type === 'group' ? 'group' : 'single')
  const [layout, setLayout] = useState(project?.layout ?? 'layout-1')
  const [previews, setPreviews] = useState<string[]>([])
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
```

改成：

```tsx
function ProjectForm({
  project,
  categories,
  onSubmit,
  onCancel
}: {
  project?: Project
  categories: ProjectCategoryWithUsage[]
  onSubmit: (fd: FormData) => Promise<void>
  onCancel: () => void
}) {
  const [type, setType] = useState<'single' | 'group'>(project?.type === 'group' ? 'group' : 'single')
  const [layout, setLayout] = useState(project?.layout ?? 'layout-1')
  const [categoryIds, setCategoryIds] = useState<string[]>(
    project ? categories.filter(c => project.tags.includes(c.title)).map(c => c.id) : []
  )
  const [previews, setPreviews] = useState<string[]>([])
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
```

把：

```tsx
      <div className='flex flex-col gap-2'>
        <Label htmlFor='tags'>標籤</Label>
        <Input id='tags' name='tags' defaultValue={project?.tags.join(', ')} placeholder='標籤（用逗號分隔）' />
      </div>
```

改成：

```tsx
      <div className='flex flex-col gap-2'>
        <Label htmlFor='categoryIds'>標籤</Label>
        <Select multiple name='categoryIds' value={categoryIds} onValueChange={v => setCategoryIds(v as string[])}>
          <SelectTrigger id='categoryIds' className='w-full'>
            <SelectValue placeholder='選擇標籤' />
          </SelectTrigger>
          <SelectContent>
            {categories.map(c => (
              <SelectItem key={c.id} value={c.id}>
                {c.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {categoryIds.length === 0 && <p className='text-sm text-amber-600'>標籤未設定</p>}
      </div>
```

- [ ] **Step 4: 型別檢查**

Run: `npx tsc --noEmit`
Expected：無錯誤。

- [ ] **Step 5: 瀏覽器驗證**

Run: `npm run dev`，在「作品」tab：
- 編輯一筆現有作品，確認多選 Select 已經預先勾選它原本的標籤（跟編輯前的 `tags` 一致）。
- 把全部標籤取消勾選，確認畫面立刻出現「標籤未設定」提示文字，且存檔按鈕仍可點（不擋 submit）。
- 存檔後，回「分類」tab 確認對應分類的 `usageCount` 有正確增減。
- 新增一筆作品，勾選 2 個標籤存檔，到 `/projects` 頁面用該標籤篩選，確認新作品有出現。

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/ProjectsTab.tsx src/app/admin/AdminDashboard.tsx
git commit -m "feat: replace tags text input with category multi-select"
```

---

## 收尾檢查（跑完全部 Task 後）

- [ ] `npx tsc --noEmit` 全專案無錯誤。
- [ ] `npm run lint` 無新增的 lint 錯誤。
- [ ] `npm run build` 成功（確認 Server Components/Server Actions 沒有邊界問題）。
- [ ] 手動走一次完整流程：首頁 Project/Pricing 卡片 → `/projects` 標籤篩選 → 後台三個 tab 的 CRUD/排序/刪除 → 登出回前台。
