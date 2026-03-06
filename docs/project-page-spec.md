# Project Page Specification

這份文件記錄了「專案作品展示頁面」(Project Page) 的功能規格、使用情境、資料庫結構，以及推薦的技術堆疊與實作細節。

## 1. 功能規格 (Functional Specification)

### 1.1 圖片網格 (Image Grid)
- 頁面核心為一個乘載大量圖片（50 張以上）的瀑布流或規則 Grid 佈局。
- 支援大量的作品快速瀏覽。

### 1.2 動態篩選器 (Dynamic Filters)
使用者可以透過點擊不同的標籤（tag）來過濾顯示的圖片。
- **維度 (Dimensions) 範例**：
  - 專案類型：社群、廣告、插畫、動畫等...
  - 品牌：各合作品牌名稱
  - 風格：可愛、時尚、科技感等...
- **動態標籤**：Filter 的選項與標籤數量並非寫死在前端，而是根據資料庫回傳的實際資料動態產出。

### 1.3 頁面路由與狀態 (Routing & Entry Point)
- **單一頁面架構**：從首頁 (`src/components/sections/Project.tsx`) 點擊各個不同專案分類時，目標網址實際上都是指到同一個「作品展示頁面」。
- **預設篩選狀態**：首頁點進來時，會解析帶入的參數（預計使用 URL Query parameters），自動啟動並選中對應的預設 Filter tag，顯示相對應的圖片集合。

### 1.4 平滑佈局動畫 (Layout & Enter/Exit Animations)
- 當使用者勾選或取消勾選 filter 標籤時，圖片的增減不能只是單純瞬間閃爍式的 render 變化。
- **需求**：
  - **進場 (Enter)**：符合條件的圖片要有淡入 (Fade-in) 或放大移入的效果。
  - **退場 (Exit)**：不符合條件的圖片要有淡出效果在卸載前完成。
  - **重排 (Layout)**：留下來的圖片，要能夠平滑順暢地移動到更新後的位置。

---

## 2. 資料庫結構 (Database Schema)

資料庫將使用 **Supabase (PostgreSQL)**，圖片檔案則統一存放在 **Cloudinary**，以便進行動態的圖片裁切與壓縮。

為了達成上述的動態 filter，資料庫結構建議的概念如下（可利用 PostgreSQL 的 Array 型別或是建立關聯表）：

### `Images` (圖片主表)
- `id` (UUID/Int)
- `public_id` (String) - 存放 Cloudinary 上的 public ID (方便前端透過 `CldImage` 直接調用)
- `order` (Int) - 控制顯示順序權重
- `tags` (Array of Strings) - 可直接存放關聯的 tags 陣列，例如：`['社群', '可愛', 'Nike']`。如果系統複雜度高，亦可拆分成關聯資料表 (Many-to-Many)。

### *(Optional)* `Tags` (標籤分類表)
如需獨立管理 tag 的分組與名稱，可以開一張表：
- `id` (UUID/Int)
- `category` (String) - 例如 "專案類型"、"品牌"、"風格"
- `name` (String) - 例如 "插畫"、"可愛"

---

## 3. 推薦技術與實作 Spec (Technical Recommendations)

### 3.1 URL 狀態管理 (URL Query Parameters)
強烈建議使用網址加上 query params 來維護 filter 狀態（例如：`/projects?type=社群&style=可愛`），而不是單純用 React `useState`。
- **優點**：可以透過 URL 直接還原先前的過濾狀態。
- **首頁串接**：在 `Project.tsx` 中點擊「社群專案」時，可以直接放入 `href="/projects?tag=社群專案"`，作品頁只要讀取 `searchParams` 就能自動套用對應的篩選。

### 3.2 動畫函式庫 (Animation Library)
要達成完美的平滑增減與排列動畫，推薦以下技術方案：

1. **Framer Motion (強烈推薦 ✨)**
   - 業界公認 React 生態中最成熟的動畫庫。
   - **`layout` prop**：只要在 grid 的單個圖片 item 元件上加上 `layout`，Framer motion 就會自動運算 DOM 物件的位置變化並補間動畫。
   - **`AnimatePresence`元件**：將列表包覆在其中，即可輕易設定 `initial`, `animate` 和 `exit` 來控制進入與離開時的動效。

2. **@formkit/auto-animate**
   - 如果不想寫太多複雜的 Framer motion 設定，這個庫提供了「一行程式碼」就能實現列表新增/刪除及佈局平移的優勢。
   - 缺點是對於進退場跟重排的細部自定義程度不如 Framer Motion 高，但開發成本極低。

### 3.3 大量圖片效能最佳化 (Performance Optimization)
因為頁面會同時存在 50 張以上的圖片，為避免一次載入拖慢速度，我們將搭配 **Cloudinary** 來處理：
- **`next-cloudinary` (CldImage)**：專案中會使用 `<CldImage>` 元件取代 Next.js 原生的 `<Image>`。它不僅能做到 lazy loading、自動產生 `srcset`，還可以依靠 Cloudinary CDN 動態壓縮圖片（自動轉為 WebP/AVIF）以及依賴參數即時最佳化。
- **Sizes**：設定合理的 `sizes` (如 `sizes="(max-width: 768px) 50vw, 25vw"`) 以幫助載入適合裝置的圖檔大小。
- **Priority**：前 10 張進入首屏視野內的圖片可以加上 `priority={true}`。
- 如果總數會繼續暴增（如 200 張以上），應考慮實作 Infinite Scrolling (無限捲軸) 來分批讀取。

### 3.4 實作程式碼架構預覽 (Framer Motion 範例思路)

```tsx
import { motion, AnimatePresence } from 'framer-motion';
import { CldImage } from 'next-cloudinary';

export default function ProjectGrid({ filteredImages }) {
  return (
    <motion.div layout className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <AnimatePresence>
        {filteredImages.map((img) => (
          <motion.div
            key={img.id}
            layout             // 自動處理重排動畫
            initial={{ opacity: 0, scale: 0.8 }} // 進場前狀態
            animate={{ opacity: 1, scale: 1 }}   // 進場後狀態
            exit={{ opacity: 0, scale: 0.8 }}    // 退場動畫 (很重要，不能瞬間消失)
            transition={{ duration: 0.3 }}
          >
            <CldImage 
              src={img.public_id} 
              alt="project" 
              width={400} 
              height={400} 
              sizes="(max-width: 768px) 50vw, 25vw"
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
```
