'use client'

import { useActionState } from 'react'
import { loginAction, type LoginState } from '../actions'

const initial: LoginState = { error: '' }

export default function AdminLoginPage() {
  const [state, action, pending] = useActionState(loginAction, initial)

  return (
    <div className='fixed inset-0 flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-400 p-4'>
      <form
        action={action}
        className='w-full max-w-sm rounded-2xl border border-white/40 bg-white/30 p-8 shadow-xl backdrop-blur-md'>
        <h1 className='mb-6 text-2xl font-bold text-black'>後台登入</h1>
        <input
          type='password'
          name='password'
          autoFocus
          required
          placeholder='密碼'
          className='mb-4 w-full rounded-lg border border-white/50 bg-white/60 px-4 py-2 text-black outline-none focus:border-black'
        />
        {state.error && <p className='mb-4 text-sm text-red-600'>{state.error}</p>}
        <button
          type='submit'
          disabled={pending}
          className='w-full rounded-lg bg-black py-2 text-white transition-opacity hover:opacity-80 disabled:opacity-50'>
          {pending ? '驗證中…' : '登入'}
        </button>
      </form>
    </div>
  )
}
