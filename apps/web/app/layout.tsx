import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FitNotes App",
  description: "Your personal fitness tracking companion",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/* TODO: wrap with Supabase SessionContextProvider once auth is wired */}
        {children}
      </body>
    </html>
  );
}
