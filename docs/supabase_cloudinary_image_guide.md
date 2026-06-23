# Supabase 與 Cloudinary 圖片存取與管理整合指南

本指南詳細分析與總結了本專案整合 **Supabase** 與 **Cloudinary** 進行圖片存取、優化與同步刪除的技術實作。你可以將此文件的架構與程式碼直接套用到其他新專案中。

---

## 1. 系統架構設計

在現代 Web 開發中，將「圖片處理/分發 (CDN)」與「資料庫管理 (DBMS)」解耦是最佳實踐：
- **Cloudinary**：負責圖片的實體儲存、動態優化（自動轉 WebP/AVIF、自適應畫質、調整尺寸）及全球 CDN 加速分發。
- **Supabase**：僅作為中繼資料 (Metadata) 資料庫，儲存圖片的網址 (`url`)、寬度 (`width`)、高度 (`height`)、替代文字 (`alt`) 以及關聯的業務資料。

---

## 2. 環境變數設定 (.env)

在你的專案根目錄 `.env` 檔案中，需要配置以下環境變數：

```bash
# Supabase 連線資訊
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # 僅在 Server 端使用，用於繞過 RLS 的後台操作

# Cloudinary 連線資訊
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

---

## 3. 初始化用戶端 (Clients Setup)

### 3.1 Cloudinary Server SDK 初始化 (`lib/cloudinary.ts`)
在後台進行上傳與刪除時，需在伺服器端使用 Cloudinary 的 Node.js SDK。

```typescript
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export default cloudinary
```

### 3.2 Supabase Clients 初始化 (`utils/supabase/`)
區分「前台/一般用戶」與「後台 Admin」連線：

#### 一般伺服器端 Client (例如：`utils/supabase/server.ts`)
用於前台查詢，依賴 cookie 驗證：
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

#### 後台 Admin Client (例如：`utils/supabase/admin.ts`)
用於後台操作，使用 Service Role Key 繞過 RLS（須確保已實作 Admin 權限校驗）：
```typescript
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase admin credentials')
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
```

---

## 4. 前台顯示圖片邏輯 (Frontend Optimization)

前台顯示圖片時，建議使用 `next-cloudinary` 提供的 `CldImage` 元件（基於 Next.js `next/image` 封裝），它可以直接接收 Cloudinary 的完整 URL。

### 4.1 優化圖片元件 (`components/OptimizedImage.tsx`)
這是一個優化的通用圖片元件：
- `format="auto"`：自動根據瀏覽器支援度提供 WebP、AVIF 或原始格式。
- `quality="auto"`：自動壓縮畫質，在視覺無損的情況下大幅降低檔案體積。
- **動態模糊預覽圖 (Blur Placeholder)**：將原始 URL 中的 `/upload/` 置換成 `/upload/w_10,e_blur:1000,q_1/`。Cloudinary 會即時生成一張寬度 10px、套用高斯模糊、品質極低的超微縮圖。這適合作為 `blurDataURL` 傳入，在圖片載入前呈現極佳的過渡效果。

```tsx
'use client'

import { CldImage } from 'next-cloudinary'

type OptimizedImageProps = {
  url: string
  alt: string | null
  width: number
  height: number
  className?: string
  sizes: string
  eager?: boolean
}

export default function OptimizedImage({
  url,
  alt,
  className = '',
  sizes,
  width,
  height,
  eager = false,
}: OptimizedImageProps) {
  // 生成 Cloudinary 的模糊預覽網址
  const blurUrl = url.includes('/upload/')
    ? url.replace('/upload/', '/upload/w_10,e_blur:1000,q_1/')
    : url

  return (
    <CldImage
      src={url}
      alt={alt ?? ''}
      className={className}
      sizes={sizes}
      width={width}
      height={height}
      format="auto"
      quality="auto"
      placeholder="blur"
      blurDataURL={blurUrl}
      loading={eager ? 'eager' : 'lazy'}
    />
  )
}
```

---

## 5. 後台新增圖片邏輯 (Create / Upload)

在伺服器端（如 Next.js Server Actions），接收前端上傳的 `FormData` 檔案，透過 Node.js 串流上傳至 Cloudinary，最後將網址儲存至 Supabase。

### 5.1 上傳並儲存邏輯 (`app/_actions/admin/image.ts`)

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import cloudinary from '@/lib/cloudinary'
import { getAuthorizedAdminClient } from '../common' // 你的權限驗證邏輯

export async function uploadImageAction(formData: FormData) {
  const supabase = await getAuthorizedAdminClient() // 取得具備 Admin 權限的 client
  
  const file = formData.get('image') as File
  const alt = formData.get('alt') as string
  
  if (!file) {
    throw new Error('未提供圖片檔案')
  }

  // 1. 將 File 轉成 Buffer
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // 2. 利用 Cloudinary upload_stream 上傳
  const uploadResult = await new Promise<any>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder: 'my_project/gallery' }, (error, result) => {
        if (error) reject(error)
        else resolve(result)
      })
      .end(buffer)
  })

  // 3. 將 Cloudinary 回傳的 URL 與圖片資訊，寫入 Supabase 中
  const { data, error } = await supabase
    .from('images')
    .insert({
      url: uploadResult.secure_url, // Cloudinary 安全網址
      width: uploadResult.width,
      height: uploadResult.height,
      alt: alt || '',
    })
    .select()

  if (error) {
    // 註：若寫入 DB 失敗，可考慮呼叫 Cloudinary 刪除剛才上傳的圖片以防產生垃圾圖片
    await cloudinary.uploader.destroy(uploadResult.public_id)
    throw new Error('資料庫寫入失敗：' + error.message)
  }

  revalidatePath('/gallery')
  return { success: true, data }
}
```

---

## 6. 後台刪除圖片邏輯 (Sync Delete)

> [!WARNING]
> 如果只刪除 Supabase 記錄，儲存在 Cloudinary 的圖片檔案將會永遠殘留。為了解決這個問題，必須在刪除資料庫欄位的同時，也向 Cloudinary API 發出刪除請求。

### 6.1 從 URL 解析 `public_id` 的 Helper 函式
Cloudinary 刪除圖片時需要傳入 `public_id`。我們可以透過正則表達式或字串分割，從完整的圖片網址中提取 `public_id`。

```typescript
/**
 * 從 Cloudinary 完整 URL 提取 public_id
 * 範例網址：
 * https://res.cloudinary.com/cloud-name/image/upload/v1717395000/my_project/gallery/pic_123.jpg
 * 提取結果：my_project/gallery/pic_123
 */
export function getPublicIdFromUrl(url: string): string | null {
  if (!url) return null

  // 1. 找出 /upload/ 之後的字串路徑
  const parts = url.split('/upload/')
  if (parts.length < 2) return null

  const pathWithVersion = parts[1] // 例如: v1717395000/my_project/gallery/pic_123.jpg

  // 2. 移除版本號（例如 v1717395000）
  const pathParts = pathWithVersion.split('/')
  if (pathParts[0].startsWith('v') && !isNaN(Number(pathParts[0].substring(1)))) {
    pathParts.shift() // 移除陣列中第一個元素（即版本號）
  }

  const pathWithoutVersion = pathParts.join('/') // 例如: my_project/gallery/pic_123.jpg

  // 3. 去除副檔名
  const lastDotIndex = pathWithoutVersion.lastIndexOf('.')
  if (lastDotIndex !== -1) {
    return pathWithoutVersion.substring(0, lastDotIndex)
  }

  return pathWithoutVersion
}
```

### 6.2 同步刪除實作邏輯

在刪除圖片的 API/Action 中，遵循以下流程：
1. 先查詢該記錄，取得圖片 URL。
2. 從 URL 解析出 `public_id`。
3. 呼叫 Cloudinary API `cloudinary.uploader.destroy(publicId)` 刪除實體檔案。
4. 呼叫 Supabase 刪除資料庫中的記錄。

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import cloudinary from '@/lib/cloudinary'
import { getAuthorizedAdminClient } from '../common'
import { getPublicIdFromUrl } from './helper' // 解析 public_id 的函式

export async function deleteImageAction(id: string) {
  const supabase = await getAuthorizedAdminClient()

  // 1. 查詢資料庫，獲取該圖片的 URL
  const { data: imageRecord, error: fetchError } = await supabase
    .from('images')
    .select('url')
    .eq('id', id)
    .single()

  if (fetchError || !imageRecord) {
    return { success: false, error: '找不到該圖片記錄：' + fetchError?.message }
  }

  const imageUrl = imageRecord.url

  // 2. 解析出 Cloudinary 的 public_id
  const publicId = getPublicIdFromUrl(imageUrl)
  
  if (publicId) {
    try {
      // 3. 從 Cloudinary 刪除實體檔案
      const cloudinaryResult = await cloudinary.uploader.destroy(publicId)
      
      if (cloudinaryResult.result !== 'ok') {
        console.warn(`Cloudinary 刪除可能未完全成功 (狀態: ${cloudinaryResult.result})，publicId: ${publicId}`)
      }
    } catch (cloudinaryError) {
      console.error('Cloudinary 刪除發生錯誤：', cloudinaryError)
      // 可根據業務需求決定是否中斷。通常建議拋出錯誤或記錄 Log。
      throw new Error('Cloudinary 實體圖片刪除失敗')
    }
  } else {
    console.error('無法從 URL 解析 public_id:', imageUrl)
  }

  // 4. 從 Supabase 中刪除中繼資料記錄
  const { error: deleteError } = await supabase
    .from('images')
    .delete()
    .eq('id', id)

  if (deleteError) {
    console.error('Supabase 刪除記錄失敗：', deleteError)
    return { success: false, error: '資料庫記錄刪除失敗' }
  }

  revalidatePath('/gallery')
  return { success: true }
}
```

---

## 7. 最佳實踐與防錯機制 (Best Practices)

1. **例外處理 (Rollback 上傳)**：
   在「後台新增圖片」時，如果上傳 Cloudinary 成功，但隨後的 Supabase DB insert 失敗，應在 `catch` 區塊中，主動呼叫 `cloudinary.uploader.destroy(public_id)` 將剛上傳的實體檔案刪除，以防 Cloudinary 空間被無效的孤兒圖片佔滿。
2. **多圖批次上傳與刪除**：
   對於多張圖的處理，建議使用 `Promise.all` 併發處理上傳與刪除，以提升 API 回應速度。
3. **安全考量 (RLS)**：
   - 圖片的 `url` 可以設定為公開讀取。
   - 所有新增與刪除圖片的 Action，必須包裝在權限驗證邏輯之下（如本專案的 `getAuthorizedAdminClient`），僅允許已驗證的 Admin 呼叫。
