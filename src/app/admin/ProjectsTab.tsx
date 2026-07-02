'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Reorder, useDragControls } from 'framer-motion'
import { type Project, type ProjectCategoryWithUsage } from '@/lib/projects'
import {
  createProjectAction,
  updateProjectAction,
  deleteProjectAction,
  reorderAction
} from './actions'
import { useReorderList } from './useReorderList'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog'

const thumb = (url: string) =>
  url.includes('/upload/') ? url.replace('/upload/', '/upload/w_200,c_limit,f_auto,q_auto/') : url

export default function ProjectsTab({
  initialProjects,
  categories
}: {
  initialProjects: Project[]
  categories: ProjectCategoryWithUsage[]
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const refresh = () => router.refresh()
  const { items, setItems, persistOrder } = useReorderList(initialProjects, reorderAction, refresh)

  return (
    <div>
      <div className='mb-8'>
        {creating ? (
          <Card>
            <CardContent>
              <ProjectForm
                categories={categories}
                onCancel={() => setCreating(false)}
                onSubmit={async fd => {
                  await createProjectAction(fd)
                  setCreating(false)
                  refresh()
                }}
              />
            </CardContent>
          </Card>
        ) : (
          <Button onClick={() => setCreating(true)} className='rounded-full'>
            + 新增專案
          </Button>
        )}
      </div>

      <Reorder.Group as='ul' axis='y' values={items} onReorder={setItems} className='flex flex-col gap-3'>
        {items.map(p => (
          <ProjectItem
            key={p.id}
            project={p}
            categories={categories}
            editing={editing === p.id}
            onToggleEdit={() => setEditing(editing === p.id ? null : p.id)}
            onDragEnd={persistOrder}
            onDone={refresh}
            onSubmit={async fd => {
              await updateProjectAction(p.id, fd)
              setEditing(null)
              refresh()
            }}
          />
        ))}
      </Reorder.Group>
    </div>
  )
}

function ProjectItem({
  project: p,
  categories,
  editing,
  onToggleEdit,
  onDragEnd,
  onDone,
  onSubmit
}: {
  project: Project
  categories: ProjectCategoryWithUsage[]
  editing: boolean
  onToggleEdit: () => void
  onDragEnd: () => void
  onDone: () => void
  onSubmit: (fd: FormData) => Promise<void>
}) {
  const dragControls = useDragControls()

  return (
    <Reorder.Item
      value={p}
      as='li'
      dragListener={false}
      dragControls={dragControls}
      onDragEnd={onDragEnd}
      whileDrag={{ scale: 1.02, boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
      <Card>
        <CardContent>
          <div className='flex items-center gap-4'>
            <span
              onPointerDown={e => dragControls.start(e)}
              className='cursor-grab touch-none select-none text-muted-foreground'
              title='拖曳排序'>
              ⠿
            </span>
            {p.images[0] && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={thumb(p.images[0].url)} alt='' className='h-16 w-16 shrink-0 rounded object-cover' />
            )}
            <div className='min-w-0 flex-1'>
              <div className='truncate font-bold'>{p.title || '（無標題）'}</div>
              <div className='mt-1 flex flex-wrap items-center gap-1.5'>
                <Badge variant='secondary'>{p.type}</Badge>
                {p.layout && <Badge variant='outline'>{p.layout}</Badge>}
                <span className='truncate text-sm text-muted-foreground'>
                  {p.images.length} 圖 · {p.tags.join(', ')}
                </span>
              </div>
            </div>
            <Button variant='outline' size='sm' onClick={onToggleEdit}>
              {editing ? '關閉' : '編輯'}
            </Button>
            <DeleteButton id={p.id} onDone={onDone} />
          </div>

          {editing && (
            <div className='mt-4 border-t pt-4'>
              <ProjectForm project={p} categories={categories} onCancel={onToggleEdit} onSubmit={onSubmit} />
            </div>
          )}
        </CardContent>
      </Card>
    </Reorder.Item>
  )
}

function DeleteButton({ id, onDone }: { id: string; onDone: () => void }) {
  const [pending, start] = useTransition()
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button variant='destructive' size='sm' disabled={pending}>
            刪除
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>確定刪除？</AlertDialogTitle>
          <AlertDialogDescription>圖片會一併從 Cloudinary 清除，此操作無法復原。</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            variant='destructive'
            onClick={() => start(async () => {
              await deleteProjectAction(id)
              onDone()
            })}>
            刪除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function ProjectForm({
  project,
  categories,
  onSubmit,
  onCancel
}: {
  project?: Project
  categories: ProjectCategoryWithUsage[]
  onSubmit: (fd: FormData) => Promise<void>
  onCancel: () => void
}) {
  const [type, setType] = useState<'single' | 'group'>(project?.type === 'group' ? 'group' : 'single')
  const [layout, setLayout] = useState(project?.layout ?? 'layout-1')
  const [categoryIds, setCategoryIds] = useState<string[]>(
    project ? categories.filter(c => project.tags.includes(c.title)).map(c => c.id) : []
  )
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
        fd.set('type', type)
        fd.set('layout', layout)
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
        <div className='flex flex-col gap-2'>
          <Label htmlFor='title'>標題</Label>
          <Input id='title' name='title' defaultValue={project?.title} placeholder='標題' />
        </div>
        <div className='flex flex-col gap-2'>
          <Label htmlFor='order'>順序</Label>
          <Input id='order' name='order' type='number' defaultValue={project?.order ?? 0} placeholder='順序' />
        </div>
      </div>
      <div className='flex flex-col gap-2'>
        <Label htmlFor='description'>說明</Label>
        <Textarea id='description' name='description' defaultValue={project?.description} placeholder='說明' />
      </div>
      <div className='flex flex-col gap-2'>
        <Label htmlFor='categoryIds'>標籤</Label>
        <Select multiple name='categoryIds' value={categoryIds} onValueChange={v => setCategoryIds(v as string[])}>
          <SelectTrigger id='categoryIds' className='w-full'>
            <SelectValue placeholder='選擇標籤' />
          </SelectTrigger>
          <SelectContent>
            {categories.map(c => (
              <SelectItem key={c.id} value={c.id}>
                {c.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {categoryIds.length === 0 && <p className='text-sm text-amber-600'>標籤未設定</p>}
      </div>
      <div className='flex gap-3'>
        <div className='flex flex-col gap-2'>
          <Label>類型</Label>
          <Select value={type} onValueChange={v => setType(v as 'single' | 'group')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='single'>single（單圖）</SelectItem>
              <SelectItem value='group'>group（四圖）</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {type === 'group' && (
          <div className='flex flex-col gap-2'>
            <Label>版型</Label>
            <Select value={layout} onValueChange={v => v && setLayout(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='layout-1'>layout-1（2×2）</SelectItem>
                <SelectItem value='layout-2'>layout-2（上大下三）</SelectItem>
                <SelectItem value='layout-3'>layout-3（左大右三）</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className='flex flex-col gap-2'>
        <Label htmlFor='files'>
          圖片（需 {need} 張{project ? '；留空＝不更換現有圖片' : ''}）
        </Label>
        <Input
          id='files'
          name='files'
          type='file'
          multiple
          accept='image/jpeg,image/png,image/webp,image/avif'
          onChange={e => setPreviews(Array.from(e.target.files ?? []).map(f => URL.createObjectURL(f)))}
        />
      </div>

      {(previews.length > 0 ? previews : project?.images.map(i => thumb(i.url)) ?? []).length > 0 && (
        <div className='flex flex-wrap gap-2'>
          {(previews.length > 0 ? previews : project!.images.map(i => thumb(i.url))).map((src, i) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img key={i} src={src} alt='' className='h-20 w-20 rounded object-cover' />
          ))}
        </div>
      )}

      {error && (
        <Alert variant='destructive'>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className='flex gap-2'>
        <Button type='submit' disabled={pending} className='rounded-full'>
          {pending ? '處理中…' : project ? '儲存' : '建立'}
        </Button>
        <Button type='button' variant='outline' onClick={onCancel} className='rounded-full'>
          取消
        </Button>
      </div>
    </form>
  )
}
