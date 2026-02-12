'use client';

import UserMenu from '@/components/UserMenu';

export default function Header() {
  return (
    <header className="bg-dashboard-card border-b border-dashboard-border sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
        <div className="flex-1 min-w-0" aria-hidden />
        <UserMenu />
      </div>
    </header>
  );
}
