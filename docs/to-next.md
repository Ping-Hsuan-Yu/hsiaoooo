# Vike → Next.js 移轉執行計劃

## 1. 現行架構盤點

### 技術棧

| 項目    | 現行                             | 目標                               |
| ------- | -------------------------------- | ---------------------------------- |
| 框架    | Vike 0.4.227 + vike-react 0.6.1  | Next.js 15 (App Router)            |
| React   | 19.1.0                           | 19.1.0（維持）                     |
| Bundler | Vite 6.2.4                       | Next.js 內建 (Turbopack)           |
| CSS     | TailwindCSS v4 + PostCSS         | TailwindCSS v4 + PostCSS（維持）   |
| 部署    | gh-pages（純靜態 `dist/client`） | ✅ Vercel（保留 `next/image` 優化） |
| 語言    | TypeScript                       | TypeScript（維持）                 |

### 目錄結構

```
hsiaoooo/
├── assets/                  # 靜態圖片 (svg, png, webp)
│   ├── about-avatar.png
│   ├── arrow.svg
│   ├── avatar.png
│   ├── bouzi-back.svg
│   ├── bouzi-universe.svg
│   ├── contact_me.svg
│   ├── fluid-bg.webp        # ~14MB hero 背景
│   ├── ig-logo.svg
│   ├── line-logo.svg
│   ├── pricing.svg
│   └── project.svg
├── components/
│   └── Link.tsx             # 自訂 active link（使用 usePageContext）
├── layouts/
│   └── LayoutDefault.tsx    # 全站 Layout + CSS import
├── pages/
│   ├── +config.ts           # Vike 全域設定 (Layout, title, extends vikeReact)
│   ├── +Head.tsx            # <head> 擴充（目前為空）
│   ├── +onPageTransitionStart.ts  # 頁面轉場開始 (body class toggle)
│   ├── +onPageTransitionEnd.ts    # 頁面轉場結束 (body class toggle)
│   ├── index/
│   │   ├── +Page.tsx        # 首頁（組合 5 個 section）
│   │   ├── Hello.tsx        # Hero section + NavBar
│   │   ├── About.tsx        # 關於區塊
│   │   ├── Project.tsx      # 專案清單
│   │   ├── Pricing.tsx      # 報價區塊
│   │   └── Contact.tsx      # 聯絡資訊
│   ├── about/
│   │   └── +Page.tsx        # CV 頁面
│   └── _error/
│       └── +Page.tsx        # 404/500 錯誤頁（使用 usePageContext）
├── styles/
│   ├── globals.css          # TailwindCSS v4 + @theme + Google Fonts
│   └── style.css            # 頁面轉場動畫、bg-fluid、hover 效果
├── vite.config.ts           # Vike plugin + React + TailwindCSS
├── tsconfig.json
└── package.json
```

### Vike 專有 API 使用情況

| Vike API                              | 使用位置                       | Next.js 對應                                   |
| ------------------------------------- | ------------------------------ | ---------------------------------------------- |
| `+config.ts` (Layout, title, extends) | `pages/+config.ts`             | `app/layout.tsx` + `metadata`                  |
| `+Page.tsx`                           | `pages/*/+Page.tsx`            | `app/**/page.tsx`                              |
| `+Head.tsx`                           | `pages/+Head.tsx`              | `metadata` / `generateMetadata`                |
| `usePageContext()`                    | `Link.tsx`, `_error/+Page.tsx` | `usePathname()`, `not-found.tsx` / `error.tsx` |
| `onPageTransitionStart/End`           | `pages/+onPageTransition*.ts`  | ✅ 直接移除                                     |
| `vike({ prerender: true })`           | `vite.config.ts`               | ✅ Vercel 自動 SSG                              |

---

## 2. 目標目錄結構（Next.js App Router）

```
hsiaoooo/
├── public/                  # 靜態資源（從 assets/ 搬移）
│   ├── images/
│   │   ├── about-avatar.png
│   │   ├── arrow.svg
│   │   ├── avatar.png
│   │   ├── bouzi-back.svg
│   │   ├── bouzi-universe.svg
│   │   ├── contact_me.svg
│   │   ├── fluid-bg.webp
│   │   ├── ig-logo.svg
│   │   ├── line-logo.svg
│   │   ├── pricing.svg
│   │   └── project.svg
├── src/
│   ├── app/
│   │   ├── layout.tsx       # Root Layout (取代 LayoutDefault.tsx + +config.ts)
│   │   ├── page.tsx         # 首頁 (取代 pages/index/+Page.tsx)
│   │   ├── about/
│   │   │   └── page.tsx     # CV 頁面
│   │   ├── not-found.tsx    # 404 頁面
│   │   ├── error.tsx        # 500 錯誤頁面
│   │   └── globals.css      # 全域 CSS (合併 globals.css + style.css)
│   └── components/
│       ├── sections/        # 首頁 section 組件
│       │   ├── Hello.tsx
│       │   ├── About.tsx
│       │   ├── Project.tsx
│       │   ├── Pricing.tsx
│       │   └── Contact.tsx
│       └── NavLink.tsx      # 取代 Link.tsx（使用 usePathname）
├── next.config.ts
├── tsconfig.json
├── postcss.config.mjs
└── package.json
```

---

## 3. 逐步遷移步驟

### Phase 0：準備工作

- [ ] 建立 `migration/next` 分支
- [ ] 備份現行程式碼

### Phase 1：初始化 Next.js 專案

- [ ] 使用 `npx create-next-app@latest` 初始化（React 19, TypeScript, TailwindCSS, App Router, `src/` 目錄）
- [ ] 確認 `package.json` 相依套件：保留 `react@19`, `tailwindcss@4`
- [ ] 移除所有 Vike 相關套件：`vike`, `vike-react`, `@vitejs/plugin-react`, `vite`, `@tailwindcss/vite`
- [ ] 刪除 `vite.config.ts`

### Phase 2：靜態資源遷移

- [ ] 將 `assets/` 下所有檔案搬移到 `public/images/`
- [ ] 全域搜尋替換圖片 import 路徑（Vite asset import → `public/` 靜態路徑或 `next/image`）

  ```diff
  # 之前 (Vite asset import)
  - import Avatar from '../../assets/avatar.png'
  - <img src={Avatar} alt="Avatar" />

  # 之後 (Next.js)
  + import Image from 'next/image'
  + <Image src="/images/avatar.png" alt="Avatar" width={200} height={200} />
  ```

  > **注意**：SVG 可直接用 `<img src="/images/xxx.svg">` 或轉為 React component。  
  > PNG/WebP 建議使用 `next/image` 取得自動優化。  
  > `fluid-bg.webp`（~14MB）作為 CSS 背景使用，路徑改為 `url('/images/fluid-bg.webp')`。

### Phase 3：CSS 遷移

- [ ] 合併 `styles/globals.css` 與 `styles/style.css` 為 `src/app/globals.css`
- [ ] TailwindCSS v4 配置不變，確認 `@import "tailwindcss"` 語法在 Next.js 中正常運作
- [ ] 更新 `bg-fluid` 背景圖路徑
- [ ] 移除 CSS 中的頁面轉場相關樣式（`#page-content` opacity、`body.page-is-transitioning`）
- [ ] 移除 `globals.css` 中 Google Fonts 的 `@import url()` 語句，改由 `next/font/google` 引入

  ```tsx
  // src/app/layout.tsx
  import { Inria_Sans, Noto_Sans_TC, Abhaya_Libre } from 'next/font/google'

  const inriaSans = Inria_Sans({ subsets: ['latin'], weight: '400' })
  const notoSansTC = Noto_Sans_TC({ subsets: ['latin'], weight: ['400', '700'] })
  const abhayaLibre = Abhaya_Libre({ subsets: ['latin'], weight: '500' })
  ```

  在 `@theme` 中更新 `--default-font-family` 與 `--font-abhaya` 為 `next/font` 產生的 CSS variable。

### Phase 4：Layout 遷移

- [ ] 建立 `src/app/layout.tsx`（取代 `layouts/LayoutDefault.tsx` + `pages/+config.ts`）

  ```tsx
  // src/app/layout.tsx
  import type { Metadata } from 'next'
  import './globals.css'

  export const metadata: Metadata = {
    title: 'Hsiaoooo',
    description: 'Hsiaoooo',
  }

  export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
      <html lang="zh-TW">
        <body>
          <div className="flex flex-col gap-20 layout-index">
            {children}
            <div className="font-abhaya text-center mb-4">©2025 YingHsiao</div>
          </div>
        </body>
      </html>
    )
  }
  ```

### Phase 5：頁面元件遷移

#### 5.1 首頁 `/`

- [ ] 建立 `src/app/page.tsx`
- [ ] 搬移 section 組件到 `src/components/sections/`
- [ ] 更新所有 import 路徑

#### 5.2 About 頁 `/about`

- [ ] 建立 `src/app/about/page.tsx`
- [ ] 直接搬移 `pages/about/+Page.tsx` 內容，更新 import

#### 5.3 錯誤頁面

- [ ] 建立 `src/app/not-found.tsx`（取代 Vike `_error` 的 404 邏輯）
- [ ] 建立 `src/app/error.tsx`（取代 Vike `_error` 的 500 邏輯，需 `'use client'`）

### Phase 6：元件替換

#### 6.1 `Link` 元件

- [ ] 取代 `usePageContext` → `usePathname`（from `next/navigation`）
- [ ] 使用 `next/link` 取代 `<a>` 標籤

  ```tsx
  'use client'
  import Link from 'next/link'
  import { usePathname } from 'next/navigation'

  export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
    const pathname = usePathname()
    const isActive = href === '/' ? pathname === href : pathname.startsWith(href)
    return (
      <Link href={href} className={isActive ? 'is-active' : undefined}>
        {children}
      </Link>
    )
  }
  ```

#### 6.2 頁面轉場（移除）

- [ ] 刪除 `+onPageTransitionStart.ts` / `+onPageTransitionEnd.ts`
- [ ] 移除 `style.css` 中的 `#page-content` 與 `body.page-is-transitioning` 相關 CSS

### Phase 7：部署設定（Vercel）

- [ ] 在 Vercel 連接 GitHub repo，自動偵測 Next.js 框架
- [ ] 設定 Production Branch（`main` 或 `migration/next` merge 後）
- [ ] 確認 `next/image` 優化正常運作（Vercel 內建圖片優化）
- [ ] 移除舊的 `gh-pages` 相關設定（`predeploy`, `deploy` scripts）
- [ ] 更新 `package.json` scripts

  ```json
  {
    "scripts": {
      "dev": "next dev --turbopack",
      "build": "next build",
      "start": "next start",
      "lint": "next lint"
    }
  }
  ```

### Phase 8：清理

- [ ] 刪除舊 Vike 檔案：`pages/`, `layouts/`, `assets/`, `styles/`
- [ ] 刪除 `vite.config.ts`
- [ ] 移除 `tsconfig.json` 中 Vike 相關 types（`vite/client`, `vike-react`）
- [ ] 更新 `.gitignore`（已包含 `.next`, `out`）
- [ ] 更新 `README.md`

---

## 4. 關鍵注意事項

### 圖片處理策略

| 圖片類型                                | 建議做法                                                                     |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| SVG（`arrow.svg`, `pricing.svg` 等）    | 放 `public/images/`，用 `<img>` 或轉為 React component（SVGR）               |
| PNG（`avatar.png`, `about-avatar.png`） | 使用 `next/image` + 指定 width/height                                        |
| WebP（`fluid-bg.webp`, ~14MB）          | 放 `public/images/`，CSS `background-image` 引用。建議壓縮或轉用更小的格式。 |

### TailwindCSS v4 相容性

TailwindCSS v4 已原生支援 Next.js，無需 `@tailwindcss/postcss` plugin（v4 使用 `@import "tailwindcss"` 語法），確認 `postcss.config.mjs` 正確設定即可。

### ✅ 已確認決策

- **部署方式**：Vercel（保留 `next/image` 完整優化能力）
- **頁面轉場**：直接移除（Next.js App Router client-side navigation 已足夠流暢）
- **Google Fonts**：改用 `next/font/google` 引入（自動 self-hosting + 消除 layout shift）

---

## 5. 預估工時

| Phase    | 內容           | 預估時間    |
| -------- | -------------- | ----------- |
| 0        | 準備工作       | 5 min       |
| 1        | 初始化 Next.js | 10 min      |
| 2        | 靜態資源遷移   | 10 min      |
| 3        | CSS 遷移       | 15 min      |
| 4        | Layout 遷移    | 10 min      |
| 5        | 頁面元件遷移   | 20 min      |
| 6        | 元件替換       | 15 min      |
| 7        | 部署設定       | 10 min      |
| 8        | 清理           | 10 min      |
| **合計** |                | **~2 小時** |

> 此專案結構簡單（2 頁面、無 data fetching、無 i18n、無認證），遷移風險低。
