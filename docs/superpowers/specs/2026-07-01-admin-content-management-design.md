# 後台內容管理擴充：分類（Project 標籤）與定價

## 背景

目前首頁的 Project 分類卡片（`Project.tsx`）與 Pricing 卡片（`Pricing.tsx`）都是硬編碼陣列，作品的 `tags` 是自由文字陣列（`projects.tags text[]`），三者之間沒有任何資料庫關聯。實測資料庫現有 31 筆作品，`tags` 實際只出現 7 種值，且與 `Project.tsx` 硬編碼的 7 張卡片標題完全對應——代表這其實是同一份「分類」概念被重複硬編碼了兩處。

本次要把「Project 分類」與「Pricing 項目」都收進資料庫，後台可 CRUD + 拖曳排序；作品的標籤改成從分類表多選，刪除分類時關聯標籤自動清除。

## 資料模型

```sql
-- 分類：同時驅動首頁 Project 卡片 + 作品的標籤選項
create table project_categories (
  id uuid primary key default gen_random_uuid(),
  title text not null unique,
  description text not null default '',
  "order" int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 作品 ↔ 分類 關聯表，取代 projects.tags text[]
create table project_tags (
  project_id uuid not null references projects(id) on delete cascade,
  category_id uuid not null references project_categories(id) on delete cascade,
  primary key (project_id, category_id)
);

-- 定價項目
create table pricing_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  price text not null,
  "order" int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

- `project_categories.title` 設 `unique`：前台 `/projects?tag=title` 用字串比對篩選，同名分類會互相打架。
- `project_tags` 用 FK + `on delete cascade`：刪分類或刪作品時，關聯列自動清除，不需要應用層清除邏輯，也不用擔心分類改名後舊資料的字串跟著過期。
- `pricing_items.title` 不設 unique（純顯示用，重複沒關係）。
- RLS：兩張新表都跟著 `projects` 的模式——開 RLS、`select` 給 public（前台用 anon key 讀），寫入一律走 `actions.ts` 的 service-role client（`db()`）。

### Migration（含既有資料）

1. 建立三張新表（含 RLS policy）。
2. 用 `Project.tsx` 現有硬編碼的 7 筆 `{title, description}` seed `project_categories`（`order` 依現有陣列順序）。
3. 依 `projects.tags` 現有內容（字串對應 `project_categories.title`），為每筆作品產生對應的 `project_tags` 列。
4. 用 `Pricing.tsx` 現有硬編碼的 8 筆 `{title, description, price}` seed `pricing_items`（`order` 依現有陣列順序）。
5. Drop `projects.tags` 欄位。

## 前台變更

- **`Project.tsx`**：改成 `async` Server Component，讀 `getProjectCategories()`（依 `order` 排序）取代硬編碼陣列，render 邏輯不變，`link` 仍是 `/projects?tag=${encodeURIComponent(category.title)}`。
- **`Pricing.tsx`**：改成 `async` Server Component，讀 `getPricingItems()`（依 `order` 排序），卡片 render 邏輯不變。
- **`ProjectGallery.tsx` / `projects/page.tsx`**：不需要改。`Project.tags` 對外型別維持 `string[]`，`getProjects()` 內部改成 join `project_tags → project_categories` 組出 `tags: string[]`（分類 title 陣列），篩選比對邏輯照舊，允許無標籤作品在「全部」時顯示（現有邏輯本來就只在 `selectedTags.length > 0` 時才篩，不用改）。
- **空狀態**：分類表或定價表若是空的，就渲染空陣列，不特別做 fallback UI。
- **快取**：首頁加 `export const revalidate = 3600`（比照 `/projects`）；分類/定價的 mutate action 統一 `revalidatePath('/')` + `/projects` + `/admin`。

## Admin Actions（`src/app/admin/actions.ts`）

**分類 CRUD + reorder：**
```ts
createCategoryAction(formData)   // title, description
updateCategoryAction(id, formData)
deleteCategoryAction(id)         // DB cascade 處理 project_tags
reorderCategoriesAction(orderedIds)
```

**定價 CRUD + reorder：**
```ts
createPricingAction(formData)    // title, description(可空), price
updatePricingAction(id, formData)
deletePricingAction(id)
reorderPricingAction(orderedIds)
```

- 全部照現有 pattern：先 `requireSession()`，成功後擴充版 `revalidateAll()`。
- `getProjectCategories()` 一次把每個分類的使用數量一起查出來（`project_tags` group by count），跟分類列表一起回傳，admin 開刪除確認視窗時直接讀這個數字，不用多一次 round trip。
- **作品的 tags 寫入方式**：`parseFields` 拿掉 `tags` 字串解析，改成 `formData.getAll('categoryIds')`。
  - create：project row insert 成功拿到 `id` 後，依 `categoryIds` 逐筆 insert 進 `project_tags`。
  - update：先刪掉該 project 現有的 `project_tags`，再依 `categoryIds` 重新 insert（量小不需要 diff）。

## Admin UI 結構

檔案拆分（現有 `AdminDashboard.tsx` 已 329 行，三個管理區塊會讓它更肥）：

```
src/app/admin/AdminDashboard.tsx   -- Tabs 外殼，依 active tab 渲染對應內容
src/app/admin/ProjectsTab.tsx      -- 現有作品管理內容（原封不動搬過去，tags 改多選 Select）
src/app/admin/CategoriesTab.tsx    -- 分類 CRUD + 拖曳排序
src/app/admin/PricingTab.tsx       -- 定價 CRUD + 拖曳排序
```

- Tabs：`npx shadcn add tabs`（base-ui 底層，`components.json` 已是 `base-nova` style），`variant="line"`，三個 tab：「作品 / 分類 / 定價」。用 client state 切換，不用 URL query param（三個 tab 的資料都在同一次 admin page load 撈齊）。
- **拖曳排序共用邏輯**：現有 `persistOrder`（`Reorder.Group` + 放手後打 reorder action）要用三次，抽成共用 hook（例如 `useReorderList(items, reorderAction)`），避免三份重複的 framer-motion 拖曳邏輯。
- **標籤多選**：`ProjectForm` 的 `tags` 欄位改用既有 `Select` 元件 + `multiple` prop（`@base-ui/react/select` 原生支援 multi-select，value 變 array；`name="categoryIds"` 時會自動產生多個 hidden input，`FormData.getAll('categoryIds')` 直接可用，不需要額外包裝或新元件）。
- **無標籤 warning**：`ProjectForm` 若 `categoryIds.length === 0`，顯示非阻擋性提示文字「標籤未設定」，不擋 submit。
- **刪分類確認視窗**：沿用現有 `AlertDialog` 風格（跟刪作品一致），文字動態帶入受影響作品數，例如「有 9 個作品使用此標籤，刪除後將一併移除，此操作無法復原」。

## 範圍外（Out of scope）

- 分類/定價項目沒有圖片，不走 Cloudinary。
- 不做分類的巢狀/群組結構。
- 不做 tab 的 URL 深連結（deep link）。
