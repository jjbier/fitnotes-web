"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TAB_ITEMS = [
  { href: "/dashboard", label: "Today", icon: "🏠" },
  { href: "/calendar", label: "Calendar", icon: "📅" },
  { href: "/progress", label: "Progress", icon: "📈" },
  { href: "/tools", label: "Tools", icon: "🔧" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
] as const;

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden border-t bg-card">
      {TAB_ITEMS.map(({ href, label, icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
              active ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="text-xl">{icon}</span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
