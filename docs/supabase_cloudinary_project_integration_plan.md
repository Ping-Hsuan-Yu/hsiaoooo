# Supabase 與 Cloudinary 專案多版面配置整合實作計劃書

本計劃書針對 Hsiaoooo 專案的「作品展示區」進行圖片存取、上傳與刪除的系統設計。為了滿足未來可能新增的各種版面配置（Layout）需求，本設計採**統一圖片陣列欄位 (Unified Images Array Column)** 架構，支援專案的**標題 (Title)** 與**說明 (Description)** 欄位，並包含一個**安全的單一密碼保護 (Single-Password Protection)** 的後台登入機制。

---

## 1. 核心架構設計 (Extensible Architecture Design)

### 欄位設計調整
在原先的作品集展示中，Hover 遮罩的效果是硬編碼的靜態文字 `專案展示標題`。為了使每個專案具備獨立的標題與說明，且保留圖片 metadata（避免 CLS、提升 A11y/SEO），我們將欄位設計調整如下：

1. **`title` (標題)**：`TEXT` 類型，預設為空字串，儲存專案的中文/英文標題。
2. **`description` (說明)**：`TEXT` 類型，預設為空字串，儲存專案的副標題、設計概念或說明文字。
3. **`images` (統一圖片陣列)**：採 `JSONB` 陣列保留 metadata，每項結構為 `{ url, width, height, alt, publicId }`：
   - **`single` (單圖專案)**：陣列僅包含 1 項。
   - **`group` (群組專案)**：陣列包含 4 項。
   - **未來新版面 (例如 `carousel` 或 `layout-4`)**：陣列包含 `N` 項。
   - `publicId` 直接存入可避免每次刪除時再從 URL 解析（解析方式仍保留為 fallback）。

---

## 2. 後台密碼保護機制 (Admin Password Authentication)

針對單一用戶的個人網站，使用 Supabase Auth 等複雜帳號系統會增加許多不必要的維護成本。我們採用**環境變數密碼 + 簽章 Session Token Cookie** 的防護機制（**避免將密碼直接存入 cookie**）。

### 運作原理

1. **環境變數**：在 `.env.local` 中設定：
   ```bash
   ADMIN_PASSWORD=your_secure_password           # 後台密碼（明文僅存在於 server 環境）
   ADMIN_SESSION_SECRET=long_random_string_min_32_chars  # 用於 HMAC 簽章 cookie
   ```
   兩者皆**不可**加 `NEXT_PUBLIC_` 前綴。啟動時若任一變數為 `undefined` 或空字串，應**直接拋出錯誤、阻止 server 啟動**（防止「無密碼登入」漏洞）。

2. **Cookie 設計**：
   - Cookie 名稱：`admin_session`
   - Cookie 值格式：`<expiresAt>.<hmacSHA256(expiresAt, ADMIN_SESSION_SECRET)>`
   - 設定：`httpOnly: true`、`sameSite: 'lax'`、`secure: process.env.NODE_ENV === 'production'`、`path: '/'`、`maxAge: 60 * 60 * 24 * 7`（7 天）
   - **絕不**將 `ADMIN_PASSWORD` 直接寫入 cookie。

3. **驗證流程（`verifySession()`）**：
   - 讀取 cookie，拆出 `expiresAt` 與 `signature`。
   - 比對 `Date.now() < expiresAt`。
   - 用 `ADMIN_SESSION_SECRET` 重算 HMAC，並以 `crypto.timingSafeEqual` 做**常數時間比對**。
   - 任何步驟失敗即視為未登入。

4. **登入畫面**：
   - 若驗證失敗，伺服器端直接渲染 glassmorphism 風格的密碼輸入畫面，阻擋所有 admin UI 與 server actions。
   - 管理員輸入密碼 → `loginAction` 用 `crypto.timingSafeEqual` 比對 `ADMIN_PASSWORD` → 通過後產生簽章 cookie 並 redirect。

5. **登出功能**：清除 cookie 並重新導向首頁。

6. **Rate Limit**：`loginAction` 必須有速率限制（建議用 Upstash Ratelimit 或基於 IP 的 in-memory window）：同一 IP 失敗超過 5 次/15 分鐘即拒絕。

### 中介層 (Middleware) 統一保護
所有 `/admin/*` 路徑皆透過 `middleware.ts` 統一檢查 session cookie，避免未來新增頁面時遺漏個別檢查：

```ts
// middleware.ts
import { NextResponse, type NextRequest } from 'next/server'
import { verifySessionFromCookieHeader } from '@/lib/admin/session'

export async function middleware(req: NextRequest) {
  const ok = await verifySessionFromCookieHeader(req.cookies.get('admin_session')?.value)
  if (!ok && req.nextUrl.pathname !== '/admin/login') {
    return NextResponse.rewrite(new URL('/admin/login', req.url))
  }
  return NextResponse.next()
}

export const config = { matcher: ['/admin/:path*'] }
```

> Server Actions **仍須各自再呼叫 `verifySession()`**，不能單純信任 middleware（middleware 對 server action 的攔截不可依賴）。

---

## 3. 資料庫 Schema 設計 (Database Schema)

我們將在 Supabase 中使用以下 SQL 建立 `projects` 資料表，並**明確啟用 RLS**：

```sql
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  "order" INTEGER NOT NULL DEFAULT 0,
  tags TEXT[] NOT NULL DEFAULT '{}',
  type TEXT NOT NULL CHECK (type IN ('single', 'group', 'carousel')),
  layout TEXT,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,   -- 每項：{url,width,height,alt,publicId}
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 自動維護 updated_at
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER projects_set_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 排序索引
CREATE INDEX IF NOT EXISTS projects_order_idx
  ON projects ("order" ASC, created_at DESC);

-- 啟用 RLS：anon 只能讀，寫入只走 service_role
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON projects
  FOR SELECT TO anon, authenticated
  USING (true);
-- 不為 anon 建立任何 INSERT/UPDATE/DELETE policy
-- service_role 會自動 bypass RLS（後台 Action 使用此 key）
```

> **排序查詢**統一使用 `ORDER BY "order" ASC, created_at DESC` 以保證確定性。

---

## 4. 套件依賴與配置 (Dependencies & Config)

1. **NPM 套件**：
   - `@supabase/supabase-js`、`@supabase/ssr`
   - `cloudinary`、`next-cloudinary`

2. **`.env.local`**（**不可** commit，確認 `.gitignore` 含 `.env*.local`）：
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=...
   CLOUDINARY_API_KEY=...
   CLOUDINARY_API_SECRET=...
   ADMIN_PASSWORD=...
   ADMIN_SESSION_SECRET=...
   ```

3. **`next.config.ts`**：
   - 設定 `images.remotePatterns` 允許 `res.cloudinary.com`。
   - 為支援上傳，調整 server action body limit：
     ```ts
     experimental: { serverActions: { bodySizeLimit: '10mb' } }
     ```
     （超過 10MB 的圖建議改用 Cloudinary signed upload 由 client 直傳。）

---

## 5. 後端 Server Actions 設計 (CRUD & Auth Action Layer)

### 5.1 身份驗證 Action
- **`loginAction(password)`**：
  - **先過 rate limit**，再用 `timingSafeEqual` 比對密碼。
  - 通過後產生 HMAC 簽章 cookie；失敗則回傳通用錯誤訊息（不洩漏「密碼錯」vs「rate limited」差異）。
- **`logoutAction()`**：清除 cookie。

### 5.2 檔案上傳驗證（共用 helper）
每個被接收的 `File` 必須通過以下檢查，**任何一項失敗即整體中止**：
- `file.size <= 10 * 1024 * 1024`
- `file.type ∈ ['image/jpeg', 'image/png', 'image/webp', 'image/avif']`（**禁止 SVG**：可內嵌 `<script>`）
- 讀取前數個 bytes 比對 magic number（防止偽造 MIME）

### 5.3 專案 CRUD Action（每個 action 開頭都呼叫 `verifySession()`）

- **`getProjectsAction()`**：公開，依 `order ASC, created_at DESC` 撈取。
- **`createProjectAction(formData)`**：
  1. `verifySession()`；失敗即 `throw`。
  2. 驗證所有檔案；驗證失敗即終止。
  3. `Promise.all` 上傳所有圖至 Cloudinary，收集 `{url,width,height,publicId}`。
  4. 寫入 Supabase。
  5. **完整 Rollback**：上傳階段任一張失敗，需 `Promise.all` 刪除所有已成功上傳的圖；DB 寫入失敗時同理。
- **`updateProjectAction(id, formData)`**：
  - 校驗 session。
  - 比對舊 images 與新 images，計算需刪除的 publicId 集合（**避免孤兒圖**）。
  - 上傳新增的圖。
  - DB 更新成功後，**才**刪除舊的 Cloudinary 檔案；若 DB 失敗則 rollback 新上傳的圖。
- **`deleteProjectAction(id)`**：
  - 校驗 session。
  - 取出 `images` 中所有 `publicId`，`Promise.all` 呼叫 `cloudinary.uploader.destroy`。
  - 刪除 DB row（建議先刪 DB，再刪 Cloudinary：DB 為唯一事實來源，前端不會看到已被刪除的記錄；Cloudinary 殘留可靠定期 audit 補刀）。

### 5.4 Idempotency
所有 mutate action 在 UI 端 disable 按鈕直到完成；可選擇性加上 `idempotencyKey` 欄位避免快速雙擊重複建立。

---

## 6. Admin 後台介面設計 (Admin Panel UI)

1. **未登入 (`/admin/login`)**：
   - 居中、毛玻璃密碼卡片；錯誤訊息使用通用文字（避免洩漏 rate limit 狀態）。

2. **已登入 Dashboard (`/admin`)**：
   - 頂部：登出按鈕。
   - 專案清單：拖曳排序（更新 `order` 欄位）。
   - 動態圖片上傳表單：標題、說明、標籤、順序、版面類型、圖片預覽。
   - 圖片刪除/替換時即時顯示「將從 Cloudinary 清除」提示。

---

## 7. 作品集前台整合 (Frontend Integration)

### 7.1 `src/app/projects/page.tsx` (Server Component)
- 在伺服器端呼叫 `getProjectsAction()` 撈取資料並傳遞給 Client Component。

### 7.2 `src/app/projects/ProjectGallery.tsx` (Client Component)
- 接收 `projects` 陣列作為 props。
- 將每個 `image.url + width + height + alt` 餵入 `OptimizedImage`（CldImage 封裝），避免 CLS。
- 讀取 `title` 與 `description` 替換 Hover 遮罩中的硬編碼文字。

---

## 8. 驗證與測試流程 (Verification)

1. **資料表初始化**：執行 SQL 建立 `projects`、trigger、index、RLS。
2. **環境變數防呆**：暫時移除 `ADMIN_PASSWORD`，確認 server 啟動或第一個 admin 請求**直接 throw**，而非靜默通過。
3. **安全防護測試**：
   - `/admin` 未登入 → 出現密碼畫面。
   - 直接從 client 呼叫 `createProjectAction` → 拋出未授權錯誤。
   - 偽造 / 修改 cookie → 簽章驗證失敗。
   - 重複輸入錯誤密碼 5 次 → 觸發 rate limit。
   - 上傳 .svg、.exe、20MB 大檔 → 全部被拒。
4. **Rollback 測試**：
   - Mock Supabase insert 失敗 → 確認 Cloudinary 上的圖片被刪除。
   - 上傳 4 張 group 圖、第 3 張中途斷網 → 確認前 2 張被回滾。
5. **更新替換圖片測試**：替換 group 第 2 張 → 舊圖在 Cloudinary 被刪除、新圖正常顯示。
6. **置入種子資料 (Seeding)**：
   - 執行 seed 腳本透過 Cloudinary 上傳並寫入 Supabase。
7. **功能測試**：
   - 新增、修改、刪除專案。
   - 確認前台 Hover 遮罩呈現正確標題與說明。
   - 前台圖片無 layout shift（CLS 接近 0）。

---

## 9. 已修正的安全與設計議題（變更摘要）

| 議題 | 原設計 | 修正後 |
|---|---|---|
| Cookie 內容 | 明文密碼 | HMAC 簽章 token + 過期戳 |
| 密碼比對 | `===` | `crypto.timingSafeEqual` |
| Env undefined fallback | 比對通過（漏洞） | 啟動即 throw |
| Brute-force 防護 | 無 | IP rate limit |
| RLS | 未提及 | 明確啟用 + anon 唯讀 policy |
| 檔案驗證 | 無 | 大小 / MIME / magic bytes / 禁 SVG |
| Server Action body limit | 未提 | 設定 10MB |
| Cookie `secure` | 寫死 true（dev 壞） | 依 `NODE_ENV` 切換 |
| Image metadata | 只存 URL | JSONB 含 width/height/alt/publicId |
| Rollback | 僅 single-image create | Create / Update / 多圖批次皆 cover |
| `type` 欄位 | 自由文字 | `CHECK` 列舉 |
| Admin 路由保護 | 各頁自行檢查 | Middleware 統一 + action 內再驗 |
| 排序確定性 | 僅 `order` | `order ASC, created_at DESC` + index |
| `updated_at` | 缺 | 加欄位 + trigger |
