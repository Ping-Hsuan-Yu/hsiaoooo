import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
})

export type UploadedImage = { url: string; width: number; height: number; alt: string; publicId: string }

export async function uploadImage(file: File): Promise<UploadedImage> {
  const buf = Buffer.from(await file.arrayBuffer())
  const res = await new Promise<UploadApiResponse>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder: 'hsiaoooo/projects', resource_type: 'image' }, (err, r) =>
        err || !r ? reject(err ?? new Error('upload failed')) : resolve(r)
      )
      .end(buf)
  })
  return { url: res.secure_url, width: res.width, height: res.height, alt: '', publicId: res.public_id }
}

// 盡力刪除；個別失敗不 throw（殘留檔靠日後 audit 補刀，不阻斷主流程）
export async function destroyImages(publicIds: string[]): Promise<void> {
  await Promise.all(
    publicIds.filter(Boolean).map(id =>
      cloudinary.uploader.destroy(id, { resource_type: 'image' }).catch(() => {})
    )
  )
}
