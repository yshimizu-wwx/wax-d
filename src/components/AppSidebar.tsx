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
  MapPin,
  FolderKanban,
  ListTodo,
  Settings,
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
    items.push({ href: "/case-map", label: "地図で探す", icon: MapPin });
    items.push({ href: "/requests", label: "作業依頼", icon: Send });
    items.push({ href: "/#applications", label: "申込履歴", icon: FileText });
    items.push({ href: "/my-fields", label: "My畑", icon: Sprout });
  }
  if (role === "provider") {
    items.push({ href: "/provider/projects", label: "案件", icon: FolderKanban });
    items.push({ href: "/provider/tasks", label: "作業", icon: ListTodo });
    items.push({ href: "/provider/billings", label: "請求", icon: Receipt });
    items.push({ href: "/provider/settings", label: "設定", icon: Settings });
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
        "hidden md:flex flex-col w-64 shrink-0 bg-slate-900/50 backdrop-blur-xl border-r border-white/10",
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
                "flex items-center gap-3 rounded-xl pl-3 pr-3 py-3 text-sm font-bold transition-colors border-l-4",
                isActive
                  ? "border-l-cyan-400 text-cyan-400 bg-white/5"
                  : "border-l-transparent text-slate-400 hover:text-white hover:bg-white/5"
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
