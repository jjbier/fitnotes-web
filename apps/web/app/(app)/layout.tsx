/**
 * App shell layout
 *
 * Components: Sidebar (desktop nav), MobileNav (bottom bar)
 * Auth: verifies Supabase session server-side, redirects to /login if absent
 */
import Sidebar from "@/components/layout/Sidebar";
import MobileNav from "@/components/layout/MobileNav";
import { ConfirmProvider } from "@/components/ConfirmDialog";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConfirmProvider>
      <div className="flex min-h-screen">
        {/* Skip link — first focusable element on page */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg"
        >
          Saltar al contenido
        </a>

        {/* Desktop sidebar */}
        <Sidebar />

        {/* Main content area */}
        <main id="main-content" className="flex-1 flex flex-col" tabIndex={-1}>
          <div className="flex-1 p-6 pb-20 md:pb-6">{children}</div>
        </main>

        {/* Mobile bottom nav */}
        <MobileNav />
      </div>
    </ConfirmProvider>
  );
}
