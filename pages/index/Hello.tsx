import BouziUniverse from "../../assets/bouzi-universe.svg"

export default function Hello() {
    return (
        <div className="bg-fluid h-dvh">
            <NavBar />
            <img src={BouziUniverse} alt="Bouzi Universe" className="absolute left-4 bottom-8" />
        </div>
    );
}

const menuItems = [
    { name: "Hello", link: "/" },
    { name: "About", link: "/#about" },
    { name: "Project", link: "/#project" },
    { name: "Pricing", link: "/#pricing" },
    { name: "Contact", link: "/#contact" },
];

function NavBar() {
    return (
        <div id="nav-bar" className="font-abhaya pt-8">
            <ul>
                {menuItems.map((item, index) =>
                    <a key={item.name} href={item.link}>
                        <li className="flex items-baseline gap-1">
                            <span className="text-lg">0{index + 1}</span>
                            <span>✦</span>
                            <span className="uppercase">{item.name}</span>
                        </li>
                    </a>
                )}
            </ul>
        </div>
    )
}
