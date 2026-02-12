'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Loader2,
  LogIn,
  UserPlus,
  User,
  Building,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

export default function LoginPage() {
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
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });
      if (authError) throw authError;

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', formData.email)
        .single();

      if (userError || !userData) {
        await supabase.auth.signOut();
        throw new Error(
          userError?.code === 'PGRST116'
            ? 'このメールアドレスは登録されていません。新規登録をお試しください。'
            : userError?.message || 'ユーザー情報の取得に失敗しました。'
        );
      }

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

      const redirectTo = userData.role === 'admin' ? '/admin' : userData.role === 'provider' ? '/admin' : '/';
      window.location.href = redirectTo;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'ログインに失敗しました';
      setError(message);
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
      const { data: existingUser } = await supabase.from('users').select('email').eq('email', formData.email).single();
      if (existingUser) {
        setError('このメールアドレスは既に登録されています');
        return;
      }

      const { error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: { name: formData.name, phone: formData.phone, role: formData.role, invitation_code: formData.invitationCode },
        },
      });
      if (authError) throw authError;

      const newId = (formData.role === 'farmer' ? 'F' : 'P') + Date.now();
      let associatedProviderId = formData.role === 'provider' ? newId : null;
      if (formData.role === 'farmer' && formData.invitationCode) {
        const { data: providerData } = await supabase
          .from('users')
          .select('id')
          .eq('invitation_code', formData.invitationCode)
          .eq('role', 'provider')
          .single();
        if (providerData) associatedProviderId = providerData.id;
      }

      const { error: insertError } = await supabase.from('users').insert({
        id: newId,
        email: formData.email,
        role: formData.role,
        name: formData.name,
        phone: formData.phone,
        status: 'pending',
        associated_provider_id: associatedProviderId,
        invitation_code: formData.invitationCode || null,
      });
      if (insertError) throw insertError;

      setSuccess('確認メールを送信しました。メール内のリンクをクリックして登録を完了してください。');
      setFormData({ email: '', password: '', name: '', phone: '', role: 'farmer', invitationCode: '' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '登録に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-dashboard-bg bg-gradient-to-br from-dashboard-bg via-agrix-forest/[0.06] to-dashboard-bg">
      <div className="w-full max-w-md flex flex-col items-center">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-dashboard-text tracking-tight flex items-center justify-center gap-2">
            <span className="text-agrix-forest" aria-hidden>🌾</span>
            Wayfinder AgriX Drone
          </h1>
          <p className="text-dashboard-muted font-medium mt-2 text-base">
            農家と業者をつなぐプラットフォーム
          </p>
        </div>

        <Card className="w-full max-w-md border border-dashboard-border shadow-xl overflow-hidden rounded-2xl">
          <div className="flex border-b border-dashboard-border">
            <Button
              type="button"
              variant={isLogin ? 'default' : 'ghost'}
              className={`flex-1 rounded-none h-12 font-bold ${
                isLogin
                  ? 'bg-agrix-forest text-white hover:bg-agrix-forest-light shadow-none'
                  : 'bg-dashboard-bg text-dashboard-muted hover:bg-dashboard-border hover:text-dashboard-text'
              }`}
              onClick={() => {
                setIsLogin(true);
                setError(null);
                setSuccess(null);
              }}
            >
              ログイン
            </Button>
            <Button
              type="button"
              variant={!isLogin ? 'default' : 'ghost'}
              className={`flex-1 rounded-none h-12 font-bold ${
                !isLogin
                  ? 'bg-agrix-forest text-white hover:bg-agrix-forest-light shadow-none'
                  : 'bg-dashboard-bg text-dashboard-muted hover:bg-dashboard-border hover:text-dashboard-text'
              }`}
              onClick={() => {
                setIsLogin(false);
                setError(null);
                setSuccess(null);
              }}
            >
              新規登録
            </Button>
          </div>

          <CardContent className="p-6">
            {error && (
              <div className="mb-4 p-4 bg-destructive/10 border border-destructive/30 rounded-xl text-destructive text-sm font-medium flex items-start gap-2">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="mb-4 p-4 bg-agrix-forest/10 border border-agrix-forest/30 rounded-xl text-agrix-forest text-sm font-medium flex items-start gap-2">
                <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{success}</span>
              </div>
            )}

            {isLogin ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">メールアドレス</Label>
                  <Input
                    id="login-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="example@example.com"
                    required
                    className="border-dashboard-border bg-dashboard-card"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">パスワード</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    required
                    className="border-dashboard-border bg-dashboard-card"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 font-bold rounded-xl bg-agrix-forest text-white hover:bg-agrix-forest-light border-0"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> ログイン中...
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" /> ログイン
                    </>
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label>ユーザー種別</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={formData.role === 'farmer' ? 'default' : 'secondary'}
                      className={formData.role === 'farmer' ? 'bg-agrix-forest text-white hover:bg-agrix-forest-light border-0' : ''}
                      onClick={() => setFormData({ ...formData, role: 'farmer' })}
                    >
                      <User className="w-4 h-4" /> 農家
                    </Button>
                    <Button
                      type="button"
                      variant={formData.role === 'provider' ? 'accent' : 'secondary'}
                      className={formData.role === 'provider' ? 'bg-agrix-gold text-agrix-forest hover:bg-agrix-gold-light border-0' : ''}
                      onClick={() => setFormData({ ...formData, role: 'provider' })}
                    >
                      <Building className="w-4 h-4" /> 業者
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-name">お名前</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="山田 太郎"
                    required
                    className="border-dashboard-border bg-dashboard-card"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-phone">電話番号</Label>
                  <Input
                    id="signup-phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="090-1234-5678"
                    required
                    className="border-dashboard-border bg-dashboard-card"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">メールアドレス</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="example@example.com"
                    required
                    className="border-dashboard-border bg-dashboard-card"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">パスワード</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="8文字以上"
                    required
                    minLength={8}
                    className="border-dashboard-border bg-dashboard-card"
                  />
                </div>
                {formData.role === 'farmer' && (
                  <div className="space-y-2">
                    <Label htmlFor="signup-invitation">招待コード（任意）</Label>
                    <Input
                      id="signup-invitation"
                      type="text"
                      value={formData.invitationCode}
                      onChange={(e) => setFormData({ ...formData, invitationCode: e.target.value })}
                      placeholder="業者から受け取った招待コード"
                      className="border-dashboard-border bg-dashboard-card"
                    />
                    <p className="text-xs text-dashboard-muted">業者から招待コードを受け取っている場合は入力してください</p>
                  </div>
                )}
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 font-bold rounded-xl bg-agrix-forest text-white hover:bg-agrix-forest-light border-0"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> 登録中...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" /> 新規登録
                    </>
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-dashboard-muted text-sm mt-6 text-center">
          © 2026{' '}
          <a
            href="https://wayfinderworx.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-dashboard-text hover:text-agrix-forest underline underline-offset-2"
          >
            Wayfinder WorX
          </a>
          .
        </p>
      </div>
    </main>
  );
}
