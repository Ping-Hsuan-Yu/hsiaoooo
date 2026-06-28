'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { type Project } from '@/lib/projects'
import {
  createProjectAction,
  updateProjectAction,
  deleteProjectAction,
  reorderAction,
  logoutAction
} from './actions'

const thumb = (url: string) =>
  url.includes('/upload/') ? url.replace('/upload/', '/upload/w_200,c_limit,f_auto,q_auto/') : url

export default function AdminDashboard({ initialProjects }: { initialProjects: Project[] }) {
  const router = useRouter()
  const [items, setItems] = useState(initialProjects)
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const dragId = useRef<string | null>(null)

  // server 重新驗證後同步最新資料
  useEffect(() => setItems(initialProjects), [initialProjects])

  const refresh = () => router.refresh()

  const onDrop = (targetId: string) => {
    const from = dragId.current
    dragId.current = null
    if (!from || from === targetId) return
    const next = [...items]
    const fromIdx = next.findIndex(p => p.id === from)
    const toIdx = next.findIndex(p => p.id === targetId)
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    setItems(next)
    reorderAction(next.map(p => p.id)).then(refresh)
  }

  return (
    <div className='mx-auto max-w-5xl px-4 py-10'>
      <div className='mb-8 flex items-center justify-between'>
        <h1 className='text-3xl font-bold text-black'>作品後台</h1>
        <form action={logoutAction}>
          <button className='rounded-full border border-gray-300 px-4 py-1 hover:border-black'>登出</button>
        </form>
      </div>

      <div className='mb-8'>
        {creating ? (
          <ProjectForm
            onCancel={() => setCreating(false)}
            onSubmit={async fd => {
              await createProjectAction(fd)
              setCreating(false)
              refresh()
            }}
          />
        ) : (
          <button
            onClick={() => setCreating(true)}
            className='rounded-full bg-black px-5 py-2 text-white hover:opacity-80'>
            + 新增專案
          </button>
        )}
      </div>

      <ul className='flex flex-col gap-3'>
        {items.map(p => (
          <li
            key={p.id}
            draggable
            onDragStart={() => (dragId.current = p.id)}
            onDragOver={e => e.preventDefault()}
            onDrop={() => onDrop(p.id)}
            className='rounded-xl border border-gray-200 bg-white p-3'>
            <div className='flex items-center gap-4'>
              <span className='cursor-grab select-none text-gray-400' title='拖曳排序'>
                ⠿
              </span>
              {p.images[0] && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={thumb(p.images[0].url)}
                  alt=''
                  className='h-16 w-16 shrink-0 rounded object-cover'
                />
              )}
              <div className='min-w-0 flex-1'>
                <div className='truncate font-bold text-black'>{p.title || '（無標題）'}</div>
                <div className='truncate text-sm text-gray-500'>
                  {p.type}
                  {p.layout ? ` · ${p.layout}` : ''} · {p.images.length} 圖 · {p.tags.join(', ')}
                </div>
              </div>
              <button
                onClick={() => setEditing(editing === p.id ? null : p.id)}
                className='rounded border border-gray-300 px-3 py-1 text-sm hover:border-black'>
                {editing === p.id ? '關閉' : '編輯'}
              </button>
              <DeleteButton id={p.id} onDone={refresh} />
            </div>

            {editing === p.id && (
              <div className='mt-4 border-t border-gray-100 pt-4'>
                <ProjectForm
                  project={p}
                  onCancel={() => setEditing(null)}
                  onSubmit={async fd => {
                    await updateProjectAction(p.id, fd)
                    setEditing(null)
                    refresh()
                  }}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function DeleteButton({ id, onDone }: { id: string; onDone: () => void }) {
  const [pending, start] = useTransition()
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!confirm('確定刪除？圖片會一併從 Cloudinary 清除。')) return
        start(async () => {
          await deleteProjectAction(id)
          onDone()
        })
      }}
      className='rounded border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50'>
      刪除
    </button>
  )
}

function ProjectForm({
  project,
  onSubmit,
  onCancel
}: {
  project?: Project
  onSubmit: (fd: FormData) => Promise<void>
  onCancel: () => void
}) {
  const [type, setType] = useState<'single' | 'group'>(project?.type === 'group' ? 'group' : 'single')
  const [previews, setPreviews] = useState<string[]>([])
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  const need = type === 'single' ? 1 : 4

  return (
    <form
      ref={formRef}
      onSubmit={e => {
        e.preventDefault()
        setError('')
        const fd = new FormData(e.currentTarget)
        start(async () => {
          try {
            await onSubmit(fd)
          } catch (err) {
            setError(err instanceof Error ? err.message : '操作失敗')
          }
        })
      }}
      className='flex flex-col gap-3'>
      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
        <input
          name='title'
          defaultValue={project?.title}
          placeholder='標題'
          className='rounded border border-gray-300 px-3 py-2'
        />
        <input
          name='order'
          type='number'
          defaultValue={project?.order ?? 0}
          placeholder='順序'
          className='rounded border border-gray-300 px-3 py-2'
        />
      </div>
      <input
        name='description'
        defaultValue={project?.description}
        placeholder='說明'
        className='rounded border border-gray-300 px-3 py-2'
      />
      <input
        name='tags'
        defaultValue={project?.tags.join(', ')}
        placeholder='標籤（用逗號分隔）'
        className='rounded border border-gray-300 px-3 py-2'
      />
      <div className='flex gap-3'>
        <select
          name='type'
          value={type}
          onChange={e => setType(e.target.value as 'single' | 'group')}
          className='rounded border border-gray-300 px-3 py-2'>
          <option value='single'>single（單圖）</option>
          <option value='group'>group（四圖）</option>
        </select>
        {type === 'group' && (
          <select
            name='layout'
            defaultValue={project?.layout ?? 'layout-1'}
            className='rounded border border-gray-300 px-3 py-2'>
            <option value='layout-1'>layout-1（2×2）</option>
            <option value='layout-2'>layout-2（上大下三）</option>
            <option value='layout-3'>layout-3（左大右三）</option>
          </select>
        )}
      </div>

      <label className='text-sm text-gray-500'>
        圖片（需 {need} 張{project ? '；留空＝不更換現有圖片' : ''}）
        <input
          name='files'
          type='file'
          multiple
          accept='image/jpeg,image/png,image/webp,image/avif'
          onChange={e =>
            setPreviews(Array.from(e.target.files ?? []).map(f => URL.createObjectURL(f)))
          }
          className='mt-1 block w-full text-black'
        />
      </label>

      {(previews.length > 0 ? previews : project?.images.map(i => thumb(i.url)) ?? []).length > 0 && (
        <div className='flex flex-wrap gap-2'>
          {(previews.length > 0 ? previews : project!.images.map(i => thumb(i.url))).map((src, i) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img key={i} src={src} alt='' className='h-20 w-20 rounded object-cover' />
          ))}
        </div>
      )}

      {error && <p className='text-sm text-red-600'>{error}</p>}

      <div className='flex gap-2'>
        <button
          type='submit'
          disabled={pending}
          className='rounded-full bg-black px-5 py-2 text-white hover:opacity-80 disabled:opacity-50'>
          {pending ? '處理中…' : project ? '儲存' : '建立'}
        </button>
        <button
          type='button'
          onClick={onCancel}
          className='rounded-full border border-gray-300 px-5 py-2 hover:border-black'>
          取消
        </button>
      </div>
    </form>
  )
}
