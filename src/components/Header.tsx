'use client';

import Link from 'next/link';
import UserMenu from '@/components/UserMenu';

const APP_NAME = 'Wayfinder AgriX Drone';

export default function Header() {
  return (
    <header className="bg-dashboard-card border-b border-dashboard-border sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
        <div className="flex-1 min-w-0 flex items-center">
          <Link
            href="/"
            className="text-dashboard-text font-bold text-lg truncate hover:text-agrix-forest transition-colors flex items-center gap-1.5"
          >
            <span>{APP_NAME}</span>
          </Link>
        </div>
        <UserMenu />
      </div>
    </header>
  );
}
