'use client';

import { useState, useEffect, useCallback } from 'react';
import { Building2, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { fetchLinkedProvidersForFarmer, type LinkedProvider } from '@/lib/api';

/**
 * 農家用: 紐づいている業者一覧を表示するセクション
 */
export default function FarmerLinkedProvidersList() {
  const [list, setList] = useState<LinkedProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await fetchLinkedProvidersForFarmer('');
      setList(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h3 className="text-sm font-semibold dark:text-zinc-100 text-zinc-800 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-agrix-forest" />
            紐づいている業者
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => load(true)}
            disabled={loading || refreshing}
            className="shrink-0 gap-1.5"
          >
            {refreshing ? (
              <Loader2 className="w-4 h-4 animate-spin text-agrix-forest" />
            ) : (
              <RefreshCw className="w-4 h-4 text-agrix-forest" />
            )}
            <span className="text-sm">更新</span>
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-dashboard-muted">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <p className="text-sm dark:text-zinc-400 text-zinc-500 py-4">
            まだ紐づいている業者はいません。上の「業者と紐づける」で招待コードを入力して紐づけましょう。
          </p>
        ) : (
          <ul className="space-y-2">
            {list.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50/50 dark:bg-zinc-800/30 px-4 py-3 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
              >
                <Building2 className="w-4 h-4 text-agrix-forest shrink-0" />
                <span className="font-medium dark:text-zinc-100 text-zinc-800">{p.name}</span>
                <span className="text-xs dark:text-zinc-400 text-zinc-500 ml-auto">
                  作業依頼の依頼先として選択できます
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
