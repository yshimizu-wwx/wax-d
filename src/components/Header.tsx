'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Package, Users, LogOut, FileText, Receipt } from 'lucide-react';
import { getCurrentUser, signOut, type User } from '@/lib/auth';

function getMyPageHref(role: string): string {
    if (role === 'admin') return '/admin';
    if (role === 'provider') return '/admin';
    return '/';
}

export default function Header() {
    const pathname = usePathname();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getCurrentUser().then(setUser).finally(() => setLoading(false));
    }, []);

    const handleSignOut = async () => {
        await signOut();
    };

    const isLoginPage = pathname === '/login';

    return (
        <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
                <Link href="/" className="text-xl font-black text-slate-800 tracking-tight hover:text-green-600 transition-colors">
                    <span className="text-green-600">🌾</span> Wayfinder AgriX
                </Link>

                <nav className="flex items-center gap-3">
                    {loading ? (
                        <span className="text-slate-400 text-sm">...</span>
                    ) : user ? (
                        <>
                            <Link
                                href={getMyPageHref(user.role)}
                                className="text-sm font-bold text-slate-700 hover:text-green-600 transition-colors px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center gap-1"
                            >
                                <LayoutDashboard className="w-4 h-4" />
                                マイページ
                            </Link>
                            {user.role === 'farmer' && (
                                <Link
                                    href="/#applications"
                                    className="text-sm font-bold text-slate-700 hover:text-green-600 transition-colors px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center gap-1"
                                >
                                    <FileText className="w-4 h-4" />
                                    申込履歴
                                </Link>
                            )}
                            {user.role === 'provider' && (
                                <>
                                    <Link
                                        href="/provider/reports/new"
                                        className="text-sm font-bold text-slate-700 hover:text-green-600 transition-colors px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center gap-1"
                                    >
                                        <FileText className="w-4 h-4" />
                                        実績報告
                                    </Link>
                                    <Link
                                        href="/provider/billings"
                                        className="text-sm font-bold text-slate-700 hover:text-green-600 transition-colors px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center gap-1"
                                    >
                                        <Receipt className="w-4 h-4" />
                                        請求
                                    </Link>
                                </>
                            )}
                            {(user.role === 'admin' || user.role === 'provider') && (
                                <>
                                    <Link
                                        href="/admin/masters"
                                        className="text-sm font-bold text-slate-700 hover:text-green-600 transition-colors px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center gap-1"
                                    >
                                        <Package className="w-4 h-4" />
                                        マスタ
                                    </Link>
                                    <Link
                                        href="/admin/users"
                                        className="text-sm font-bold text-slate-700 hover:text-green-600 transition-colors px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center gap-1"
                                    >
                                        <Users className="w-4 h-4" />
                                        ユーザー
                                    </Link>
                                </>
                            )}
                            <button
                                type="button"
                                onClick={handleSignOut}
                                className="text-sm font-bold text-slate-700 hover:text-red-600 transition-colors px-3 py-2 rounded-lg hover:bg-red-50 border border-slate-200 hover:border-red-200 flex items-center gap-1"
                            >
                                <LogOut className="w-4 h-4" />
                                ログアウト
                            </button>
                        </>
                    ) : (
                        <Link
                            href={isLoginPage ? '/' : '/login'}
                            className="text-sm font-bold text-white bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg transition-colors"
                        >
                            {isLoginPage ? 'トップへ' : 'ログイン'}
                        </Link>
                    )}
                </nav>
            </div>
        </header>
    );
}
