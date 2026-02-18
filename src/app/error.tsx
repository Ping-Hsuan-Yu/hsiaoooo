'use client'

export default function Error({
  reset
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className='flex flex-col items-center justify-center min-h-[60vh]'>
      <h1 className='text-4xl font-bold mb-4'>500</h1>
      <p className='text-light-gray mb-6'>Something went wrong.</p>
      <button onClick={() => reset()} className='bg-black text-white px-4 py-2 rounded-full'>
        Try again
      </button>
    </div>
  )
}
