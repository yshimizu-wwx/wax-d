"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Users,
  FileText,
  Receipt,
  Calendar,
  PlusCircle,
  Sprout,
  Building2,
  UserCheck,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { User } from "@/lib/auth";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

function getNavItems(role: string): NavItem[] {
  const items: NavItem[] = [
    { href: role === "admin" || role === "provider" ? "/admin" : "/", label: "ダッシュボード", icon: LayoutDashboard },
  ];
  if (role === "farmer") {
    items.push({ href: "/requests", label: "作業依頼", icon: Send });
    items.push({ href: "/#applications", label: "申込履歴", icon: FileText });
    items.push({ href: "/my-fields", label: "My畑", icon: Sprout });
  }
  if (role === "provider") {
    items.push({ href: "/admin/campaigns/new", label: "案件作成", icon: PlusCircle });
    items.push({ href: "/provider/calendar", label: "カレンダー", icon: Calendar });
    items.push({ href: "/provider/reports/new", label: "実績報告", icon: FileText });
    items.push({ href: "/provider/billings", label: "請求管理", icon: Receipt });
    items.push({ href: "/admin/masters", label: "マスタ", icon: Package });
    items.push({ href: "/admin/users", label: "紐付き農家", icon: Building2 });
  }
  if (role === "admin") {
    items.push({ href: "/admin/users", label: "ユーザー承認", icon: UserCheck });
    items.push({ href: "/admin/masters", label: "マスタ", icon: Package });
  }
  return items;
}

interface AppSidebarProps {
  user: User;
  className?: string;
}

export default function AppSidebar({ user, className }: AppSidebarProps) {
  const pathname = usePathname();
  const items = getNavItems(user.role);

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col w-64 shrink-0 bg-agrix-forest border-r border-white/10",
        className
      )}
    >
      <nav className="flex-1 p-3 pt-5 space-y-1 overflow-y-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition-colors",
                isActive
                  ? "bg-white/20 text-white shadow-inner"
                  : "text-white/90 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export { getNavItems };
