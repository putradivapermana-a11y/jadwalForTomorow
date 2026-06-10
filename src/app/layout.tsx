import Link from "next/link";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { BottomNav } from "@/components/navigation/BottomNav";

const inter = Inter({ subsets: ["latin"] });

import type { Viewport } from "next";

export const metadata: Metadata = {
  title: "JadwalForTomorrow | AI Schedule OS",
  description: "AI personal scheduler untuk mencatat, mengecek, dan menyusun jadwal harian.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "JadwalForTomorrow",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="dark">
      <body
        className={cn(
          inter.className,
          "min-h-screen bg-background font-sans antialiased"
        )}
      >
        <div className="relative flex min-h-screen flex-col mx-auto w-full max-w-md sm:max-w-3xl lg:max-w-4xl sm:border-x sm:bg-background/50">
          <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
            <div className="container flex h-14 items-center justify-between px-4">
              <Link className="flex items-center space-x-2" href="/">
                <span className="font-semibold text-lg tracking-tight">
                  JadwalForTomorrow
                </span>
              </Link>
              <div className="hidden sm:flex items-center space-x-6 text-sm font-medium text-muted-foreground">
                <Link href="/" className="hover:text-foreground transition-colors">Beranda</Link>
                <Link href="/plans" className="hover:text-foreground transition-colors">Plan</Link>
                <Link href="/habits" className="hover:text-foreground transition-colors">Habit</Link>
                <Link href="/notes" className="hover:text-foreground transition-colors">Catatan</Link>
                <Link href="/settings/personality" className="hover:text-foreground transition-colors">Profil</Link>
              </div>
            </div>
          </header>
          <main className="flex-1 pb-20 sm:pb-8 flex flex-col">{children}</main>
          <BottomNav />
        </div>
        <Toaster />
      </body>
    </html>
  );
}