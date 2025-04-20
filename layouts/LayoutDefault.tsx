import "../styles/globals.css";
import "../styles/style.css";

export default function LayoutDefault({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-20 layout-index">
     {children}
     <div className="font-abhaya text-center mb-4">©2025 YingHsiao</div>
    </div>
  );
}