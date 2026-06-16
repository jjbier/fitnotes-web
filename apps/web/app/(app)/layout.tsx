/**
 * App shell layout
 *
 * Components: Sidebar (desktop nav), MobileNav (bottom bar)
 * Auth: verifies Supabase session server-side, redirects to /login if absent
 */
import Sidebar from "@/components/layout/Sidebar";
import MobileNav from "@/components/layout/MobileNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main content area */}
      <main className="flex-1 flex flex-col">
        <div className="flex-1 p-6 pb-20 md:pb-6">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <MobileNav />
    </div>
  );
}
