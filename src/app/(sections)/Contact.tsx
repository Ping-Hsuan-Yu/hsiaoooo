export default function Contact() {
  return (
    <div id='contact' className='flex flex-col md:flex-row md:items-start gap-10'>
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src='/images/contact_me.svg' alt='' />
      </div>
      <div className='flex items-end md:items-start gap-10'>
        <div className='flex flex-col gap-4'>
          <p>可提供勞報 / 開立發票</p>
          <div>
            <p>yinghsiaooo@gmail.com</p>
            <p>+886 939 887 588</p>
          </div>
        </div>
        <div className='flex gap-4'>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src='/images/line-logo.svg' alt='' />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src='/images/ig-logo.svg' alt='' />
        </div>
      </div>
    </div>
  )
}
