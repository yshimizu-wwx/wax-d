'use client';

import { useCallback, useState } from 'react';

export interface GeolocationError {
  code: number;
  message: string;
  userFriendlyMessage: string;
}

function toUserMessage(code: number): string {
  switch (code) {
    case 1:
      return '位置情報が許可されていません。ブラウザの設定で位置情報を許可するか、住所で検索してください。';
    case 2:
      return '位置情報を取得できませんでした。ネットワークや設定を確認して再試行してください。';
    case 3:
      return '位置情報の取得がタイムアウトしました。もう一度お試しください。';
    default:
      return '位置情報を利用できません。住所で検索してください。';
  }
}

/**
 * ブラウザの Geolocation API で現在地を取得する。
 * 権限拒否・エラー時は userFriendlyMessage を返す。
 */
export function useGeolocation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<GeolocationError | null>(null);

  const getCurrentPosition = useCallback((): Promise<{ lat: number; lng: number } | null> => {
    if (typeof window === 'undefined' || !navigator?.geolocation) {
      setError({
        code: 0,
        message: 'Geolocation not supported',
        userFriendlyMessage: 'お使いのブラウザでは位置情報を利用できません。住所で検索してください。',
      });
      return Promise.resolve(null);
    }

    setError(null);
    setLoading(true);

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        setLoading(false);
        setError({
          code: 3,
          message: 'Timeout',
          userFriendlyMessage: toUserMessage(3),
        });
        resolve(null);
      }, 10000);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(timeout);
          setLoading(false);
          setError(null);
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          clearTimeout(timeout);
          setLoading(false);
          const code = err?.code ?? 0;
          setError({
            code,
            message: err?.message ?? 'Unknown',
            userFriendlyMessage: toUserMessage(code),
          });
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 }
      );
    });
  }, []);

  return { getCurrentPosition, loading, error, clearError: () => setError(null) };
}
