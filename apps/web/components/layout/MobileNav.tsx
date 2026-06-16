/**
 * Bottom navigation bar for mobile web viewports
 *
 * TODO: mark active tab based on current pathname (usePathname — needs "use client")
 */

const TAB_ITEMS = [
  { href: "/dashboard", label: "Today", icon: "🏠" },
  { href: "/calendar", label: "Calendar", icon: "📅" },
  { href: "/exercise", label: "Exercises", icon: "💪" },
  { href: "/progress", label: "Progress", icon: "📈" },
] as const;

export default function MobileNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden border-t bg-card">
      {TAB_ITEMS.map(({ href, label, icon }) => (
        <a
          key={href}
          href={href}
          className="flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="text-xl">{icon}</span>
          {label}
        </a>
      ))}
    </nav>
  );
}
