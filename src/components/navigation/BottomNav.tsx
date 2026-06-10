"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calendar, CheckSquare, FileText, User } from "lucide-react";
import { cn } from "@/lib/utils";

const HIDDEN_ROUTES = ["/login", "/onboarding"];

export function BottomNav() {
  const pathname = usePathname();

  // Hide on login, onboarding
  if (HIDDEN_ROUTES.includes(pathname)) {
    return null;
  }

  const items = [
    { label: "Beranda", href: "/", icon: Home },
    { label: "Plan", href: "/plans", icon: Calendar, matchPrefix: "/plan" },
    { label: "Habit", href: "/habits", icon: CheckSquare, matchPrefix: "/habit" },
    { label: "Catatan", href: "/notes", icon: FileText, matchPrefix: "/note" },
    { label: "Profil", href: "/settings/personality", icon: User, matchPrefix: "/settings" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/80 backdrop-blur-xl sm:hidden pb-safe">
      <div className="flex justify-around items-center h-16 px-2 pb-2">
        {items.map((item) => {
          const isActive =
            pathname === item.href || (item.matchPrefix && pathname.startsWith(item.matchPrefix) && pathname !== '/');
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}