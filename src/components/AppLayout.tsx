"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { getCurrentUser, type User } from "@/lib/auth";
import Header from "@/components/Header";
import AppSidebar from "@/components/AppSidebar";
import BottomNav from "@/components/BottomNav";
import { cn } from "@/lib/utils";

/** レイアウトをスキップするパス（ログイン・認証コールバック等） */
const SKIP_LAYOUT_PATHS = ["/login", "/auth"];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser().then(setUser).finally(() => setLoading(false));
  }, []);

  const skipLayout = SKIP_LAYOUT_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const showDashboardLayout = !skipLayout && !!user;

  if (skipLayout) {
    return <>{children}</>;
  }

  return (
    <div className={cn("min-h-screen", !skipLayout && "dashboard-app bg-dashboard-bg")}>
      <Header />
      <div className="flex min-h-[calc(100vh-4rem)]">
        {showDashboardLayout && user && <AppSidebar user={user} />}
        <main
          className={cn(
            "relative z-0 flex-1 w-full min-h-[calc(100vh-4rem)] overflow-auto",
            showDashboardLayout && "pb-20 md:pb-0 md:px-6 md:py-6"
          )}
        >
          {children}
        </main>
      </div>
      {showDashboardLayout && user && <BottomNav user={user} />}
    </div>
  );
}
