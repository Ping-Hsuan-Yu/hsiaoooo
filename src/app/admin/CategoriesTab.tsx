'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Reorder, useDragControls } from 'framer-motion'
import { type ProjectCategoryWithUsage } from '@/lib/projects'
import {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
  reorderCategoriesAction
} from './actions'
import { useReorderList } from './useReorderList'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
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

export default function CategoriesTab({ initialCategories }: { initialCategories: ProjectCategoryWithUsage[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const refresh = () => router.refresh()
  const { items, setItems, persistOrder } = useReorderList(initialCategories, reorderCategoriesAction, refresh)

  return (
    <div>
      <div className='mb-8'>
        {creating ? (
          <Card>
            <CardContent>
              <CategoryForm
                onCancel={() => setCreating(false)}
                onSubmit={async fd => {
                  await createCategoryAction(fd)
                  setCreating(false)
                  refresh()
                }}
              />
            </CardContent>
          </Card>
        ) : (
          <Button onClick={() => setCreating(true)} className='rounded-full'>
            + 新增分類
          </Button>
        )}
      </div>

      <Reorder.Group as='ul' axis='y' values={items} onReorder={setItems} className='flex flex-col gap-3'>
        {items.map(category => (
          <CategoryItem
            key={category.id}
            category={category}
            editing={editing === category.id}
            onToggleEdit={() => setEditing(editing === category.id ? null : category.id)}
            onDragEnd={persistOrder}
            onDone={refresh}
            onSubmit={async fd => {
              await updateCategoryAction(category.id, fd)
              setEditing(null)
              refresh()
            }}
          />
        ))}
      </Reorder.Group>
    </div>
  )
}

function CategoryItem({
  category,
  editing,
  onToggleEdit,
  onDragEnd,
  onDone,
  onSubmit
}: {
  category: ProjectCategoryWithUsage
  editing: boolean
  onToggleEdit: () => void
  onDragEnd: () => void
  onDone: () => void
  onSubmit: (fd: FormData) => Promise<void>
}) {
  const dragControls = useDragControls()

  return (
    <Reorder.Item
      value={category}
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
            <div className='min-w-0 flex-1'>
              <div className='truncate font-bold'>{category.title}</div>
              <div className='truncate text-sm text-muted-foreground'>
                {category.description || '（無說明）'} · {category.usageCount} 個作品使用
              </div>
            </div>
            <Button variant='outline' size='sm' onClick={onToggleEdit}>
              {editing ? '關閉' : '編輯'}
            </Button>
            <DeleteCategoryButton category={category} onDone={onDone} />
          </div>

          {editing && (
            <div className='mt-4 border-t pt-4'>
              <CategoryForm category={category} onCancel={onToggleEdit} onSubmit={onSubmit} />
            </div>
          )}
        </CardContent>
      </Card>
    </Reorder.Item>
  )
}

function DeleteCategoryButton({
  category,
  onDone
}: {
  category: ProjectCategoryWithUsage
  onDone: () => void
}) {
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
          <AlertDialogTitle>確定刪除「{category.title}」？</AlertDialogTitle>
          <AlertDialogDescription>
            {category.usageCount > 0
              ? `有 ${category.usageCount} 個作品使用此標籤，刪除後將一併移除，此操作無法復原。`
              : '此操作無法復原。'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            variant='destructive'
            onClick={() => start(async () => {
              await deleteCategoryAction(category.id)
              onDone()
            })}>
            刪除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function CategoryForm({
  category,
  onSubmit,
  onCancel
}: {
  category?: ProjectCategoryWithUsage
  onSubmit: (fd: FormData) => Promise<void>
  onCancel: () => void
}) {
  const [error, setError] = useState('')
  const [pending, start] = useTransition()

  return (
    <form
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
      <div className='flex flex-col gap-2'>
        <Label htmlFor='title'>標題</Label>
        <Input id='title' name='title' defaultValue={category?.title} placeholder='標題' />
      </div>
      <div className='flex flex-col gap-2'>
        <Label htmlFor='description'>說明</Label>
        <Textarea id='description' name='description' defaultValue={category?.description} placeholder='說明' />
      </div>

      {error && (
        <Alert variant='destructive'>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className='flex gap-2'>
        <Button type='submit' disabled={pending} className='rounded-full'>
          {pending ? '處理中…' : category ? '儲存' : '建立'}
        </Button>
        <Button type='button' variant='outline' onClick={onCancel} className='rounded-full'>
          取消
        </Button>
      </div>
    </form>
  )
}
