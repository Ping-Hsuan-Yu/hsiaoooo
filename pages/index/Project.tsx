import Arrow from "../../assets/arrow.svg"
import ProjectSvg from "../../assets/project.svg"

const projects = [
    { title: "社群專案", description: "粉絲專頁圖文設計", link: "" },
    { title: "廣告Banner", description: "廣告素材 / 電商圖片", link: "" },
    { title: "一頁式Landing page", description: "商品頁面 / 銷售頁面製作", link: "" },
    { title: "動畫製作", description: "簡易小動畫 / GIF", link: "" },
    { title: "插畫設計", description: "貼圖 / 吉祥物 / 自由創作作品", link: "" },
    { title: "視覺設計", description: "LOGO設計 / 招牌設計 / 菜單設計 / 名片設計", link: "" },
    { title: "商品攝影", description: "商品拍攝後製 / 情境拍攝", link: "" },
]

export default function Project() {
    return (
        <div id="project">
            <div className="mb-8"><img src={ProjectSvg} alt="Pricing" /></div>
            {projects.map((project) =>
                <ProjectCard key={project.title} title={project.title} description={project.description} link={project.link} />
            )}
        </div>
    )
}

function ProjectCard({ title, description, link }: { title: string; description: string; link: string }) {
    return (
        <div className="border-b-2 flex justify-between items-center py-3 md:py-4">
            <div className="flex flex-col md:flex-row items-baseline gap-2">
                <div className="text-2xl font-bold">{title}</div>
                <div className="text-sm text-light-gray">{description}</div>
            </div>
            <img src={Arrow} alt="" />
        </div>
    );
}