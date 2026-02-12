"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Calendar, FileText, Receipt, Package, Users, Sprout, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getNavItems } from "@/components/AppSidebar";

interface BottomNavProps {
  user: { role: string };
  className?: string;
}

export default function BottomNav({ user, className }: BottomNavProps) {
  const pathname = usePathname();
  const items = getNavItems(user.role);

  // モバイルでは最大5項目程度に制限（主要なものだけ）
  const mobileItems = items.slice(0, 5);

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 md:hidden border-t border-white/10 bg-agrix-forest safe-area-pb",
        className
      )}
    >
      <div className="flex items-center justify-around h-16 safe-area-pb">
        {mobileItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 min-w-0 py-3 text-xs font-bold transition-colors min-h-[44px]",
                isActive ? "text-white bg-white/20" : "text-white/80 hover:text-white hover:bg-white/10"
              )}
            >
              <Icon className={cn("h-6 w-6 shrink-0", isActive && "stroke-[2.5]")} />
              <span className="truncate max-w-[4.5rem]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
