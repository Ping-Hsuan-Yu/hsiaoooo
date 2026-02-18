import Link from 'next/link'

export default function NotFound() {
  return (
    <div className='flex flex-col items-center justify-center min-h-[60vh]'>
      <h1 className='text-4xl font-bold mb-4'>404</h1>
      <p className='text-light-gray mb-6'>This page could not be found.</p>
      <Link href='/' className='bg-black text-white px-4 py-2 rounded-full'>
        Go Home
      </Link>
    </div>
  )
}
