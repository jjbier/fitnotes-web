"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createBrowserClient } from "@fitnotes/database";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Today", icon: "🏠" },
  { href: "/calendar", label: "Calendar", icon: "📅" },
  { href: "/exercise", label: "Exercises", icon: "💪" },
  { href: "/progress", label: "Progress", icon: "📈" },
  { href: "/routines", label: "Routines", icon: "📋" },
  { href: "/body-tracker", label: "Body Tracker", icon: "⚖️" },
  { href: "/tools", label: "Tools", icon: "🔧" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
] as const;

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <aside className="hidden md:flex w-60 flex-col border-r bg-card min-h-screen">
      {/* Brand */}
      <div className="flex items-center gap-2 px-6 py-5 border-b">
        <span className="text-2xl">🏋️</span>
        <span className="font-bold text-lg">FitNotes</span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-secondary"
              }`}
            >
              <span>{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
            U
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">Account</p>
          </div>
          <button
            onClick={handleSignOut}
            className="text-xs text-muted-foreground hover:text-foreground"
            title="Sign out"
            aria-label="Sign out"
          >
            ↩
          </button>
        </div>
      </div>
    </aside>
  );
}
