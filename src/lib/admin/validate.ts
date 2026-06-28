// 上傳檔案驗證：大小 / MIME allowlist / magic bytes。禁 SVG（可內嵌 <script>）。
const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const

function matchesMagic(head: Uint8Array, mime: string): boolean {
  const at = (i: number, bytes: number[]) => bytes.every((b, k) => head[i + k] === b)
  const ascii = (i: number, s: string) => [...s].every((c, k) => head[i + k] === c.charCodeAt(0))
  switch (mime) {
    case 'image/jpeg':
      return at(0, [0xff, 0xd8, 0xff])
    case 'image/png':
      return at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    case 'image/webp':
      return ascii(0, 'RIFF') && ascii(8, 'WEBP')
    case 'image/avif':
      // 0..3 = box size，4..7 = 'ftyp'，8..11 = brand（avif/avis/mif1/msf1…）
      return ascii(4, 'ftyp')
    default:
      return false
  }
}

export async function validateImageFile(file: File): Promise<void> {
  if (file.size === 0) throw new Error(`${file.name}: 空檔`)
  if (file.size > MAX_BYTES) throw new Error(`${file.name}: 超過 10MB`)
  if (!ALLOWED.includes(file.type as (typeof ALLOWED)[number])) {
    throw new Error(`${file.name}: 不支援的格式（僅 JPEG/PNG/WebP/AVIF，禁止 SVG）`)
  }
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  if (!matchesMagic(head, file.type)) throw new Error(`${file.name}: 檔頭與宣告格式不符`)
}
