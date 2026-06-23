import Image from 'next/image'
import Link from 'next/link'

const experience = [
  {
    time: '2O21.04-至今',
    title: '自由接案工作者',
    description: ''
  },
  {
    time: '2O20.12-2O21.04',
    title: '佳佳百貨有限公司',
    description: '設計助理'
  },
  {
    time: '2017.09-2020.09',
    title: '生洋網路股份有限公司',
    description: '視覺設計師'
  },
  {
    time: '2O13-2O17',
    title: '世新大學圖文傳播暨數位出版學系',
    description: '學士畢業'
  }
]

const skills = [
  { title: '軟體', name: 'Adobe Ai / Ps / Ae' },
  { title: '作業系統', name: 'Mac OS' },
  { title: '語言', name: '中文 / 英文' }
]

export default function AboutPage() {
  return (
    <main className='mt-20 max-w-5xl mx-auto'>
      <section className='flex flex-col md:flex-row-reverse mb-10'>
        <div className='md:hidden mx-auto'>
          <Image src='/images/about-avatar.png' alt='' width={300} height={300} />
        </div>
        <div>
          <div className='hidden md:block float-right w-1/3 mt-8 ms-8'>
            <Image src='/images/about-avatar.png' alt='' width={300} height={300} />
          </div>
          <p className='font-bold text-3xl'>蕭穎</p>
          <p className='text-xl text-light-gray'>Ying Hsiao</p>
          <p className='flex flex-col gap-2 text-light-gray mt-6'>
            <span>
              1995｜臺灣高雄人｜現居新北市
              <br />
              活潑外向、充滿好奇心の巨蟹北漂青年
            </span>
            <span>
              擁有設計、攝影的專業經驗，活躍於網路行銷經手過數百間廠商，將全媒體的素材設計發揮到淋漓盡致。
            </span>
            <span>
              除了專業領域的深耕，也樂於學習新事物與接受挑戰，曾於公司擔任年度設計素材講師，從中獲得如何與他人分享專業經驗並協助其解決問題的方式。
            </span>
            <span>
              傾聽跟溝通是合作中讓我最重視的部分，相信透過不同意見的交流與分享，才能讓成果以完美的樣子呈現。
            </span>
            <span>
              平時喜歡關注藝文、影視與網路媒體等流行文化，最近也在研究自媒體的經營，期待在水瓶時代中，能夠多元化的發展，找出自己不同的價值，創造出更豐富的作品。
            </span>
          </p>
        </div>
      </section>
      <section className='flex flex-col md:flex-row gap-8 md:justify-between'>
        <div className='flex gap-10'>
          <span className='text-2xl font-bold'>經歷</span>
          <div className='flex flex-col gap-4'>
            {experience.map(({ time, title, description }) => (
              <div className='flex flex-col' key={title}>
                <span className='font-bold'>{time}</span>
                <span className='text-light-gray'>{title}</span>
                <span className='text-light-gray'>{description}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className='flex gap-10 md:w-82.5'>
            <span className='text-2xl font-bold'>技能</span>
            <div className='flex flex-col gap-4'>
              {skills.map(({ title, name }) => (
                <div key={title} className='flex flex-col'>
                  <span className='font-bold'>{title}</span>
                  <span className='text-light-gray'>{name}</span>
                </div>
              ))}
            </div>
          </div>
          <div className='mt-8 flex md:justify-end'>
            <Link href='/'>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src='/images/bouzi-back.svg' alt='' />
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
