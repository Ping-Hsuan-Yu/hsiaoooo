import Avatar from "../../assets/avatar.png"

export default function About() {
    return (
        <div id="about">
            <div className="flex items-center">
                <div>
                    <div className="flex items-center">
                        <div>
                            <div className="flex items-center gap-2 mb-6">
                                <span className="font-bold text-3xl">蕭穎</span>
                                <span className="text-xl text-light-gray">Ying Hsiao</span>
                            </div>
                            <div className="block md:hidden">自由工作者，2017開始於廣告社群行銷產業打滾至今熟悉各種<span className="font-bold mx-1">網路媒體廣告設計</span>的邏輯與方向，擁有眾多<span className="font-bold mx-1">品牌社群經營</span>與<span className="font-bold mx-1">素材規劃製作</span>的經驗</div>
                            <div className="hidden md:block">自由工作者，2017開始於廣告社群行銷產業打滾至今熟悉各種<span className="font-bold mx-1">網路媒體廣告設計</span>的邏輯與方向，擁有眾多<span className="font-bold mx-1">品牌社群經營</span>與<span className="font-bold mx-1">素材規劃製作</span>的經驗，認為<span className="font-bold">「有良好的溝通，才會有好的作品。」</span>除了美觀的設計外，讓想傳達的訊息發揮效益才是目標。</div>
                        </div>
                        <div className="mx-2 md:hidden"><img src={Avatar} alt="Avatar" /></div>
                    </div>
                    <div className="block md:hidden mt-4">認為<span className="font-bold">「有良好的溝通，才會有好的作品。」</span>除了美觀的設計外，讓想傳達的訊息發揮效益才是目標</div>
                    <div className="mt-4">用我的多元宇宙想法，帶給你不同的設計切角，任何的社群、設計需求，歡迎讓我們成為合作夥伴<span className="text-nowrap">･◡･</span></div>
                </div>
                <div className="mx-2 hidden md:block"><img src={Avatar} alt="Avatar" /></div>
            </div>
            <button className="flex items-center gap-2 bg-black text-white px-4 py-1 rounded-full mt-6">
                <span>Go to CV</span>
                <span>→</span>
            </button>
        </div>
    )
}