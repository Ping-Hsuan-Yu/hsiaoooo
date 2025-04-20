import PricingSvg from "../../assets/pricing.svg"

const pricingOptions = [
    { title: "廣告Banner", description: "", price: "NT$ 1,000-1,500" },
    { title: "社群圖片(FB/IG/LINE)", description: "素材設計單張價格，長期合作可議價", price: "NT$ 800-1,200" },
    { title: "一頁式Landing page", description: "依照視覺複雜度與長度調整報價", price: "NT$ 10,000-15,000" },
    { title: "EDM/菜單/DM", description: "不含印刷，如需統包另外加價", price: "NT$ 1,000-1,500" },
    { title: "名片設計", description: "不含印刷，如需統包另外加價", price: "NT$ 3,000" },
    { title: "LOGO設計", description: "僅含標誌圖像設計與建立品牌色，非CIS識別", price: "NT$ 5,000" },
    { title: "簡易動畫製作", description: "視動畫難易度調整價格", price: "NT$ 1,500起" },
    { title: "商品拍攝", description: "商品去背照/情境照", price: "NT$ 500-800" },
]

export default function Pricing() {
    return (
        <div id="pricing">
            <div className="mb-8"><img src={PricingSvg} alt="Pricing" /></div>
            <div className="flex flex-col gap-4">
                {pricingOptions.map((option) =>
                    <PriceCard
                        key={option.title}
                        title={option.title}
                        description={option.description}
                        price={option.price}
                    />
                )}
            </div>
        </div>
    );
}

function PriceCard({ title, description, price }: { title: string; description: string; price: string; }) {
    return (
        <div className="border rounded-full flex justify-between items-center h-20 px-5">
            <div className="flex flex-col md:flex-row gap-2 items-baseline">
                <div className="font-bold md:text-2xl">{title}</div>
                {description && <div className="text-xs md:text-sm text-light-gray">{description}</div>}
            </div>
            <div className="font-bold md:text-2xl">{price}</div>
        </div>
    )
}