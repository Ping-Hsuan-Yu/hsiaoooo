import { getPricingItems } from '@/lib/projects'

export default async function Pricing() {
  const items = await getPricingItems()

  return (
    <div id='pricing'>
      <div className='mb-8'>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src='/images/pricing.svg' alt='Pricing' />
      </div>
      <div className='flex flex-col gap-4'>
        {items.map(item => (
          <PriceCard key={item.id} title={item.title} description={item.description} price={item.price} />
        ))}
      </div>
    </div>
  )
}

function PriceCard({
  title,
  description,
  price
}: {
  title: string
  description: string
  price: string
}) {
  return (
    <div className='border rounded-full flex justify-between items-center h-20 px-5'>
      <div className='flex flex-col md:flex-row gap-2 items-baseline'>
        <div className='font-bold md:text-2xl'>{title}</div>
        {description && <div className='text-xs md:text-sm text-light-gray'>{description}</div>}
      </div>
      <div className='font-bold md:text-2xl'>{price}</div>
    </div>
  )
}
