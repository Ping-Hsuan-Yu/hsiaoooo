import Link from 'next/link'

export default function BackHome() {
  return (
    <Link href='/' aria-label='回到首頁' className='inline-block mb-6'>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className='w-8 rotate-180' src='/images/arrow.svg' alt='' />
    </Link>
  )
}
