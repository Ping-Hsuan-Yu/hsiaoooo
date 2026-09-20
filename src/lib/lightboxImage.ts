import { getCldImageUrl } from 'next-cloudinary'

// Lightbox 顯示用的圖。不限制寬度會拿到原始尺寸的 derivative（原圖可到 8000px / 9MB），
// 首次請求要 Cloudinary 現轉再傳，實測 22s；限制 w_1600 後 750KB。
// ponytail: 1600 對 Retina 直向圖夠用；若橫向大圖覺得糊再往上調（改這裡，兩邊都跟著動）。
export const lightboxImageUrl = (publicId: string) =>
  getCldImageUrl({ src: publicId, width: 1600, crop: 'limit' })

// 先跟 Cloudinary 要一次，逼它把 derivative 生出來存好（實測省掉之後每個「第一次」的 ~2s 轉檔）。
// Accept 要跟瀏覽器一致，f_auto 才會挑到同一個格式、命中同一份 derivative。
export async function warmLightboxImage(publicId: string): Promise<void> {
  await fetch(lightboxImageUrl(publicId), {
    headers: { Accept: 'image/avif,image/webp,image/apng,*/*' }
  }).catch(() => {})
}
