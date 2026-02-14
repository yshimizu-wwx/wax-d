'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, LayoutDashboard, LogOut, ChevronDown } from 'lucide-react';
import { getCurrentUser, signOut, type User as AuthUser } from '@/lib/auth';
import { cn } from '@/lib/utils';

function getMyPageHref(role: string): string {
  return '/mypage';
}

export default function UserMenu() {
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getCurrentUser().then(setUser).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [open]);

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
  };

  const isLoginPage = pathname === '/login';

  if (loading) {
    return (
      <div className="h-10 w-10 rounded-full bg-slate-200 animate-pulse" aria-hidden />
    );
  }

  if (!user) {
    return (
      <Link
        href={isLoginPage ? '/' : '/login'}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors',
          'bg-agrix-forest text-white hover:bg-agrix-forest-dark shadow-sm'
        )}
      >
        {isLoginPage ? 'トップへ' : 'ログイン'}
      </Link>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        data-testid="user-menu-trigger"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-2 rounded-xl px-2 py-2 md:pl-3 md:pr-3 border border-slate-200 bg-white hover:bg-slate-50 transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-agrix-forest focus:ring-offset-2'
        )}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-agrix-forest text-white font-bold text-sm">
          <User className="h-5 w-5" />
        </span>
        <span className="hidden md:inline text-sm font-bold text-slate-800 truncate max-w-[8rem]">
          {user.email?.split('@')[0] || 'マイページ'}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-slate-500 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-slate-200 bg-white shadow-lg py-1 z-50"
          role="menu"
        >
          <div className="px-3 py-2 border-b border-slate-100">
            <p className="text-xs text-slate-500">ログイン中</p>
            <p className="text-sm font-bold text-slate-800 truncate">{user.email}</p>
          </div>
          <Link
            href={getMyPageHref(user.role)}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            role="menuitem"
          >
            <LayoutDashboard className="h-4 w-4 text-agrix-forest" />
            マイページ
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
            role="menuitem"
          >
            <LogOut className="h-4 w-4" />
            ログアウト
          </button>
        </div>
      )}
    </div>
  );
}
