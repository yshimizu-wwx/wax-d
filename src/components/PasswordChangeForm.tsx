'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updatePassword } from '@/lib/auth';

const MIN_LENGTH = 8;

export default function PasswordChangeForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (newPassword.length < MIN_LENGTH) {
      setMessage({ type: 'error', text: `パスワードは${MIN_LENGTH}文字以上にしてください。` });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: '新しいパスワードと確認が一致しません。' });
      return;
    }
    setSubmitting(true);
    try {
      const result = await updatePassword(newPassword);
      if (result.success) {
        setMessage({ type: 'success', text: 'パスワードを変更しました。' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setMessage({ type: 'error', text: result.error || '変更に失敗しました。' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="text-lg font-bold text-dashboard-text mb-4">パスワード変更</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="new-password">新しいパスワード</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={`${MIN_LENGTH}文字以上`}
              className="mt-1"
              minLength={MIN_LENGTH}
              autoComplete="new-password"
            />
          </div>
          <div>
            <Label htmlFor="confirm-password">新しいパスワード（確認）</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="再入力"
              className="mt-1"
              autoComplete="new-password"
            />
          </div>
          {message && (
            <p
              className={
                message.type === 'success'
                  ? 'text-sm text-agrix-forest font-medium'
                  : 'text-sm text-red-600 font-medium'
              }
            >
              {message.text}
            </p>
          )}
          <Button type="submit" disabled={submitting} variant="outline">
            {submitting ? '変更中...' : 'パスワードを変更'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
