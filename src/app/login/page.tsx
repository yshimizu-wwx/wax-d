'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
    const router = useRouter();
    const [isLogin, setIsLogin] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: '',
        phone: '',
        role: 'farmer' as 'farmer' | 'provider',
        invitationCode: '',
    });

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            // Sign in with Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: formData.email,
                password: formData.password,
            });

            if (authError) throw authError;

            // Fetch user data from public.users table
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('email', formData.email)
                .single();

            if (userError) throw userError;

            // Check user status
            if (userData.status === 'pending') {
                setError('メール認証が完了していません。届いたメールを確認してください。');
                await supabase.auth.signOut();
                return;
            }

            if (userData.role === 'provider' && userData.status === 'under_review') {
                setError('アカウントは審査中です。管理者による承認後、ログインが可能になります。');
                await supabase.auth.signOut();
                return;
            }

            if (userData.status === 'suspended' || userData.status === 'rejected') {
                setError('このアカウントは現在利用できません。');
                await supabase.auth.signOut();
                return;
            }

            // Redirect based on role (admin -> /admin, provider -> /admin/campaigns, farmer -> /)
            router.refresh();
            if (userData.role === 'admin') {
                router.push('/admin');
            } else if (userData.role === 'provider') {
                router.push('/admin/campaigns');
            } else {
                router.push('/');
            }
        } catch (err: any) {
            console.error('Login error:', err);
            setError(err.message || 'ログインに失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setSuccess(null);

        try {
            // Check if email already exists in public.users
            const { data: existingUser } = await supabase
                .from('users')
                .select('email')
                .eq('email', formData.email)
                .single();

            if (existingUser) {
                setError('このメールアドレスは既に登録されています');
                return;
            }

            // Sign up with Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    emailRedirectTo: `${window.location.origin}/auth/callback`,
                    data: {
                        name: formData.name,
                        phone: formData.phone,
                        role: formData.role,
                        invitation_code: formData.invitationCode,
                    }
                }
            });

            if (authError) throw authError;

            // Generate user ID
            const newId = (formData.role === 'farmer' ? 'F' : 'P') + Date.now();

            // Determine associated_provider_id from invitation code
            let associatedProviderId = formData.role === 'provider' ? newId : null;
            if (formData.role === 'farmer' && formData.invitationCode) {
                const { data: providerData } = await supabase
                    .from('users')
                    .select('id')
                    .eq('invitation_code', formData.invitationCode)
                    .eq('role', 'provider')
                    .single();

                if (providerData) {
                    associatedProviderId = providerData.id;
                }
            }

            // Insert into public.users table
            const { error: insertError } = await supabase
                .from('users')
                .insert({
                    id: newId,
                    email: formData.email,
                    role: formData.role,
                    name: formData.name,
                    phone: formData.phone,
                    status: 'pending', // Will be updated after email confirmation
                    associated_provider_id: associatedProviderId,
                    invitation_code: formData.invitationCode || null,
                });

            if (insertError) throw insertError;

            setSuccess('確認メールを送信しました。メール内のリンクをクリックして登録を完了してください。');

            // Clear form
            setFormData({
                email: '',
                password: '',
                name: '',
                phone: '',
                role: 'farmer',
                invitationCode: '',
            });
        } catch (err: any) {
            console.error('Signup error:', err);
            setError(err.message || '登録に失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo/Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-black text-slate-800 mb-2">
                        <span className="text-green-600">🌾</span> ドローンあいのり予約
                    </h1>
                    <p className="text-slate-500 font-medium">農家と業者をつなぐプラットフォーム</p>
                </div>

                {/* Auth Card */}
                <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
                    {/* Tab Switcher */}
                    <div className="flex border-b border-slate-200">
                        <button
                            onClick={() => {
                                setIsLogin(true);
                                setError(null);
                                setSuccess(null);
                            }}
                            className={`flex-1 py-4 font-bold transition-colors ${isLogin
                                    ? 'bg-green-600 text-white'
                                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                                }`}
                        >
                            ログイン
                        </button>
                        <button
                            onClick={() => {
                                setIsLogin(false);
                                setError(null);
                                setSuccess(null);
                            }}
                            className={`flex-1 py-4 font-bold transition-colors ${!isLogin
                                    ? 'bg-green-600 text-white'
                                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                                }`}
                        >
                            新規登録
                        </button>
                    </div>

                    {/* Form Content */}
                    <div className="p-8">
                        {error && (
                            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium">
                                <i className="fas fa-exclamation-circle mr-2"></i>
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm font-medium">
                                <i className="fas fa-check-circle mr-2"></i>
                                {success}
                            </div>
                        )}

                        {isLogin ? (
                            <form onSubmit={handleLogin} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">
                                        メールアドレス
                                    </label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-green-500"
                                        placeholder="example@example.com"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">
                                        パスワード
                                    </label>
                                    <input
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-green-500"
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full bg-green-600 text-white py-4 rounded-xl font-black shadow-lg hover:bg-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? (
                                        <>
                                            <i className="fas fa-spinner fa-spin mr-2"></i>ログイン中...
                                        </>
                                    ) : (
                                        <>
                                            <i className="fas fa-sign-in-alt mr-2"></i>ログイン
                                        </>
                                    )}
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleSignup} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">
                                        ユーザー種別
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, role: 'farmer' })}
                                            className={`p-3 rounded-xl font-bold transition-all ${formData.role === 'farmer'
                                                    ? 'bg-green-600 text-white shadow-lg'
                                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                        >
                                            <i className="fas fa-user mr-2"></i>農家
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, role: 'provider' })}
                                            className={`p-3 rounded-xl font-bold transition-all ${formData.role === 'provider'
                                                    ? 'bg-blue-600 text-white shadow-lg'
                                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                        >
                                            <i className="fas fa-building mr-2"></i>業者
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">
                                        お名前
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-green-500"
                                        placeholder="山田 太郎"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">
                                        電話番号
                                    </label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-green-500"
                                        placeholder="090-1234-5678"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">
                                        メールアドレス
                                    </label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-green-500"
                                        placeholder="example@example.com"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">
                                        パスワード
                                    </label>
                                    <input
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-green-500"
                                        placeholder="8文字以上"
                                        required
                                        minLength={8}
                                    />
                                </div>

                                {formData.role === 'farmer' && (
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">
                                            招待コード（任意）
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.invitationCode}
                                            onChange={(e) => setFormData({ ...formData, invitationCode: e.target.value })}
                                            className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-green-500"
                                            placeholder="業者から受け取った招待コード"
                                        />
                                        <p className="text-xs text-slate-500 mt-1">
                                            業者から招待コードを受け取っている場合は入力してください
                                        </p>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full bg-green-600 text-white py-4 rounded-xl font-black shadow-lg hover:bg-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? (
                                        <>
                                            <i className="fas fa-spinner fa-spin mr-2"></i>登録中...
                                        </>
                                    ) : (
                                        <>
                                            <i className="fas fa-user-plus mr-2"></i>新規登録
                                        </>
                                    )}
                                </button>
                            </form>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-slate-500 text-sm mt-6">
                    © 2026 ドローンあいのり予約. All rights reserved.
                </p>
            </div>
        </main>
    );
}
