'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { calculateCurrentUnitPrice } from '@/lib/calculator/priceCalculator';
import { fetchActiveProject, fetchCampaignTotalArea, createBooking, type BookingData } from '@/lib/api';
import { Project } from '@/types/database';
import type { Polygon } from 'geojson';
import type { FarmerFormData } from '@/components/CampaignForm';

// Dynamically import components to avoid SSR issues
const PolygonMap = dynamic(() => import('@/components/PolygonMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-100 animate-pulse rounded-2xl flex items-center justify-center text-slate-400">
      地図を読み込み中...
    </div>
  )
});

const CampaignForm = dynamic(() => import('@/components/CampaignForm'), {
  ssr: false,
});

export default function Home() {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [area10r, setArea10r] = useState<number>(0);
  const [polygon, setPolygon] = useState<Polygon | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number }[] | null>(null);
  const [totalCampaignArea, setTotalCampaignArea] = useState<number>(0);

  // Load active project and total area on mount
  useEffect(() => {
    async function loadProject() {
      const activeProject = await fetchActiveProject();
      setProject(activeProject);

      if (activeProject) {
        const totalArea = await fetchCampaignTotalArea(activeProject.id);
        setTotalCampaignArea(totalArea);
      }

      setLoading(false);
    }
    loadProject();
  }, []);

  const handlePolygonComplete = (
    newCoords: { lat: number; lng: number }[] | null,
    newArea10r: number,
    newPolygon: Polygon | null
  ) => {
    setCoords(newCoords);
    setArea10r(newArea10r);
    setPolygon(newPolygon);
  };

  const handleFormSubmit = async (formData: FarmerFormData) => {
    if (!project || !polygon) {
      alert('案件情報または圃場データが不足しています');
      return;
    }

    // Calculate the locked price at submission time using TOTAL area
    const pricing = {
      base_price: project.base_price || 0,
      min_price: project.min_price || 0,
      target_area_10r: project.target_area_10r || 0,
      min_target_area_10r: project.min_target_area_10r,
      max_target_area_10r: project.max_target_area_10r,
      execution_price: project.execution_price,
    };

    const simulatedTotalArea = totalCampaignArea + area10r;
    const validation = calculateCurrentUnitPrice(pricing, simulatedTotalArea);
    const lockedPrice = validation.currentPrice ?? project.base_price ?? 0;

    const bookingData: BookingData = {
      campaign_id: project.id,
      farmer_name: formData.farmerName,
      phone: formData.phone,
      email: formData.email,
      desired_start_date: formData.desiredStartDate,
      desired_end_date: formData.desiredEndDate,
      field_polygon: polygon,
      area_10r: area10r,
      locked_price: lockedPrice,
    };

    const result = await createBooking(bookingData);

    if (result.success) {
      alert(`予約が完了しました!\n予約ID: ${result.bookingId}\n\n確認メールを ${formData.email} に送信しました。`);
      // Reset form
      setArea10r(0);
      setPolygon(null);
      setCoords(null);
      // Reload to clear map and refresh total area
      window.location.reload();
    } else {
      alert(`予約に失敗しました: ${result.error}`);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">読み込み中...</p>
        </div>
      </main>
    );
  }

  if (!project) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200 max-w-md text-center">
          <div className="text-6xl mb-4">🌾</div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">現在募集中の案件はありません</h1>
          <p className="text-slate-600">新しい案件が開始されるまでお待ちください。</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-green-50/30">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
                <span className="text-green-600 mr-2">🌾 Wayfinder</span>AgriX
              </h1>
              <p className="text-slate-500 text-sm font-medium mt-1">農作業予約システム</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                <span className="text-blue-700 font-bold text-xs">
                  累計: {totalCampaignArea.toFixed(1)} 反
                </span>
              </div>
              <div className="flex items-center gap-2 bg-green-50 px-4 py-2 rounded-full border border-green-200">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-green-700 font-bold text-sm">募集中</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Left Column: Map */}
          <section className="order-2 lg:order-1">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 h-[500px] lg:h-[700px] relative">
              <div className="absolute top-6 left-6 z-[1000] bg-white/95 backdrop-blur px-4 py-2 rounded-xl shadow-md border border-slate-200">
                <h2 className="text-sm font-bold text-slate-600 mb-1">圃場を描画</h2>
                <p className="text-xs text-slate-500">地図上でクリックして圃場の範囲を指定</p>
              </div>

              {/* Area Display Overlay */}
              {area10r > 0 && (
                <div className="absolute top-6 right-6 z-[1000] bg-green-600 text-white px-5 py-3 rounded-xl shadow-lg border-2 border-green-500 min-w-[180px]">
                  <div className="text-xs font-bold uppercase tracking-wider mb-1 opacity-90">選択面積</div>
                  <div className="text-3xl font-black">
                    {area10r.toFixed(2)} <span className="text-sm font-normal opacity-90">反</span>
                  </div>
                </div>
              )}

              <div className="w-full h-full rounded-xl overflow-hidden">
                <PolygonMap
                  onPolygonComplete={handlePolygonComplete}
                  initialPolygon={coords || undefined}
                />
              </div>
            </div>
          </section>

          {/* Right Column: Form */}
          <section className="order-1 lg:order-2">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <CampaignForm
                project={project}
                area10r={area10r}
                totalCampaignArea={totalCampaignArea}
                onSubmit={handleFormSubmit}
              />
            </div>
          </section>

        </div>

        {/* Footer Info */}
        <footer className="mt-8 text-center text-sm text-slate-500">
          <p>ご不明な点がございましたら、お気軽にお問い合わせください。</p>
        </footer>
      </div>
    </main>
  );
}
