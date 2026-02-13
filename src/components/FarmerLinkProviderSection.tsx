'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { linkFarmerByInvitationCode } from '@/lib/auth';

/**
 * 農家用: 招待コードで業者と紐づけるセクション
 */
export default function FarmerLinkProviderSection() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      toast.error('招待コードを入力してください');
      return;
    }
    setSubmitting(true);
    try {
      const result = await linkFarmerByInvitationCode(code);
      if (result.success) {
        setCode('');
        toast.success('業者と紐付けました。作業依頼ページへ移動します。');
        router.push('/requests');
      } else {
        toast.error(result.error ?? '紐付けに失敗しました');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="invitation-code">招待コード</Label>
            <Input
              id="invitation-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="業者から受け取った招待コードを入力"
              className="mt-1 font-mono"
              disabled={submitting}
            />
            <p className="text-xs text-dashboard-muted mt-1.5">
              依頼したい業者から招待コードを受け取り、ここに入力すると紐付けできます。紐付け後は「作業依頼」からその業者を依頼先として選べます。
            </p>
          </div>
          <Button type="submit" disabled={submitting} className="bg-agrix-forest hover:bg-agrix-forest-dark">
            {submitting ? '処理中...' : '業者と紐づける'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
