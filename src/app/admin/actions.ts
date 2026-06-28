'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { timingSafeEqual } from 'node:crypto'
import { adminConfig } from '@/lib/admin/config'
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionValue,
  verifySessionValue
} from '@/lib/admin/session'
import { canAttempt, recordFail, reset } from '@/lib/admin/rateLimit'
import { db } from '@/lib/admin/supabaseAdmin'
import { uploadImage, destroyImages, type UploadedImage } from '@/lib/admin/cloudinary'
import { validateImageFile } from '@/lib/admin/validate'

async function clientIp(): Promise<string> {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
}

// 每個 mutate action 都先呼叫，不信任 middleware（middleware 對 server action 攔截不可依賴）
async function requireSession(): Promise<void> {
  const ok = await verifySessionValue((await cookies()).get(SESSION_COOKIE)?.value)
  if (!ok) throw new Error('Unauthorized')
}

function safePwEqual(input: string, secret: string): boolean {
  const a = Buffer.from(input)
  const b = Buffer.from(secret)
  if (a.length !== b.length) {
    timingSafeEqual(a, a) // 保持時間相近，再回 false（長度差異無法常數時間隱藏）
    return false
  }
  return timingSafeEqual(a, b)
}

// ---- auth ----

export type LoginState = { error: string }

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const ip = await clientIp()
  // 先過 rate limit；通用錯誤訊息，不洩漏「密碼錯」vs「rate limited」差異
  if (!canAttempt(ip)) return { error: '登入失敗，請稍後再試' }

  const password = String(formData.get('password') ?? '')
  if (!safePwEqual(password, adminConfig.password)) {
    recordFail(ip)
    return { error: '登入失敗，請稍後再試' }
  }

  reset(ip)
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, await createSessionValue(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE
  })
  redirect('/admin')
}

export async function logoutAction(): Promise<void> {
  ;(await cookies()).delete(SESSION_COOKIE)
  redirect('/')
}

// ---- form 解析 ----

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

function getFiles(formData: FormData): File[] {
  return formData.getAll('files').filter((f): f is File => f instanceof File && f.size > 0)
}

function assertCount(type: 'single' | 'group', n: number): void {
  if (type === 'single' && n !== 1) throw new Error('single 專案需要剛好 1 張圖')
  if (type === 'group' && n !== 4) throw new Error('group 專案需要剛好 4 張圖')
}

// 全部上傳，任一失敗即回滾已成功的，回傳成功清單
async function uploadAllOrRollback(files: File[]): Promise<UploadedImage[]> {
  for (const f of files) await validateImageFile(f)
  const results = await Promise.allSettled(files.map(uploadImage))
  const ok = results.flatMap(r => (r.status === 'fulfilled' ? [r.value] : []))
  if (ok.length !== files.length) {
    await destroyImages(ok.map(u => u.publicId))
    throw new Error('圖片上傳失敗，已回滾')
  }
  return ok
}

function revalidateAll(): void {
  revalidatePath('/projects')
  revalidatePath('/admin')
}

// ---- CRUD ----

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

export async function deleteProjectAction(id: string): Promise<void> {
  await requireSession()
  // DB 為唯一事實來源：先刪 row（前台立即看不到），再清 Cloudinary
  const { data, error: readErr } = await db()
    .from('projects')
    .select('images')
    .eq('id', id)
    .single()
  if (readErr) throw new Error(readErr.message)

  const { error } = await db().from('projects').delete().eq('id', id)
  if (error) throw new Error(error.message)

  await destroyImages(((data?.images ?? []) as UploadedImage[]).map(i => i.publicId))
  revalidateAll()
}

export async function reorderAction(orderedIds: string[]): Promise<void> {
  await requireSession()
  await Promise.all(
    orderedIds.map((id, i) => db().from('projects').update({ order: i }).eq('id', id))
  )
  revalidateAll()
}
