'use client'

import { useActionState } from 'react'
import { loginAction, type LoginState } from '../actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

const initial: LoginState = { error: '' }

export default function AdminLoginPage() {
  const [state, action, pending] = useActionState(loginAction, initial)

  return (
    <div className='fixed inset-0 flex items-center justify-center p-4'>
      <Card className='w-full max-w-sm'>
        <CardHeader>
          <CardTitle className='text-2xl'>後台登入</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={action} className='flex flex-col gap-4'>
            <div className='flex flex-col gap-2'>
              <Label htmlFor='password'>密碼</Label>
              <Input id='password' type='password' name='password' autoFocus required placeholder='密碼' />
            </div>
            {state.error && (
              <Alert variant='destructive'>
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}
            <Button type='submit' disabled={pending} className='w-full'>
              {pending ? '驗證中…' : '登入'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
