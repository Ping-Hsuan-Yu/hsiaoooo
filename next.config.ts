import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'res.cloudinary.com' }],
  },
  // 後台上傳：放寬 server action body 上限（>10MB 的圖建議改 client 直傳 Cloudinary）
  experimental: { serverActions: { bodySizeLimit: '10mb' } },
}

export default nextConfig
