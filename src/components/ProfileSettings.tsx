'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getCurrentUser, updateUserProfile, type User } from '@/lib/auth';

export default function ProfileSettings() {
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getCurrentUser().then((u) => {
      if (u) {
        setUser(u);
        setName(u.name ?? '');
        setPhone(u.phone ?? '');
        setAddress(u.address ?? '');
      }
      setLoading(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await updateUserProfile({ name, phone, address });
      if (result.success) {
        setUser((prev) => prev ? { ...prev, name, phone, address } : null);
        toast.success('プロフィールを更新しました');
      } else {
        toast.error(result.error || '更新に失敗しました');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-dashboard-muted">読み込み中...</p>
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-dashboard-muted">ログインしてください。</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="text-lg font-bold text-dashboard-text mb-4">プロフィール</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="profile-email">メールアドレス（ログインID）</Label>
            <Input
              id="profile-email"
              value={user.email}
              disabled
              className="mt-1 bg-slate-50"
            />
            <p className="text-xs text-dashboard-muted mt-1">メールアドレスの変更はサポート対象外です。</p>
          </div>
          <div>
            <Label htmlFor="profile-name">氏名</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="氏名"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="profile-phone">電話番号</Label>
            <Input
              id="profile-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="090-1234-5678"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="profile-address">住所</Label>
            <Input
              id="profile-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="住所・拠点"
              className="mt-1"
            />
          </div>
          <Button type="submit" disabled={submitting} className="bg-agrix-forest hover:bg-agrix-forest-dark">
            {submitting ? '保存中...' : '保存'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
