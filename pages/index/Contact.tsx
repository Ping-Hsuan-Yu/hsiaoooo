import ContactMeSvg from "../../assets/contact_me.svg";
import LineLogoSvg from "../../assets/line-logo.svg";
import IGLogoSvg from "../../assets/ig-logo.svg";

export default function Contact() {
    return (
        <div id="contact" className="flex flex-col md:flex-row md:items-start gap-10">
            <div><img src={ContactMeSvg} alt="" /></div>
            <div className="flex items-end md:items-start gap-10">
                <div className="flex flex-col gap-4">
                    <p>可提供勞報 / 開立發票</p>
                    <div>
                        <p>yinghsiaooo@gmail.com</p>
                        <p>+886 939 887 588</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <img src={LineLogoSvg} alt="" />
                    <img src={IGLogoSvg} alt="" />
                </div>
            </div>
        </div>
    )
}