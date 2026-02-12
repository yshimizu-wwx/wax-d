"use client";

import { MapPin, Clock, Truck } from "lucide-react";
import type { FieldPoint } from "@/lib/geo/routeOptimizer";
import { buildRouteSchedule } from "@/lib/geo/routeOptimizer";
import { cn } from "@/lib/utils";

interface RouteStepsViewProps {
  /** 最適化済みの訪問順序 */
  route: FieldPoint[];
  /** 作業日 YYYY-MM-DD */
  workDate: string;
  /** 開始時刻（時） */
  startHour?: number;
  /** 開始時刻（分） */
  startMinute?: number;
  /** 1反あたり作業時間（分） */
  timePerArea?: number;
  className?: string;
}

export default function RouteStepsView({
  route,
  workDate,
  startHour = 9,
  startMinute = 0,
  timePerArea = 30,
  className,
}: RouteStepsViewProps) {
  const schedule = buildRouteSchedule(route, workDate, timePerArea, startHour, startMinute);

  if (route.length === 0) {
    return (
      <div className={cn("rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-500", className)}>
        訪問先がありません
      </div>
    );
  }

  return (
    <div className={cn("rounded-2xl border border-slate-200 bg-white overflow-hidden", className)}>
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <Truck className="w-5 h-5 text-agrix-forest" />
          訪問順序（最適ルート）
        </h3>
      </div>
      <ol className="divide-y divide-slate-100">
        {route.map((point, index) => {
          const step = schedule[index];
          const isFirst = index === 0;
          return (
            <li key={point.fieldId || point.appId || index} className="flex gap-4 p-4 hover:bg-slate-50/50">
              <div className="flex shrink-0 flex-col items-center">
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
                    isFirst ? "bg-agrix-gold text-agrix-forest" : "bg-slate-200 text-slate-700"
                  )}
                >
                  {index + 1}
                </span>
                {index < route.length - 1 && (
                  <div className="my-0.5 h-full min-h-[24px] w-0.5 bg-slate-200" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-800 flex items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0 text-agrix-forest" />
                  {point.fieldName || point.address || "圃場"}
                </p>
                <p className="text-sm text-slate-500 mt-0.5">{point.address}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {point.farmerName} · {point.area10r} 反
                </p>
                {step && (
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3" />
                      到着 {step.arrivalTime}
                    </span>
                    <span>作業 {step.workDuration}分</span>
                    <span>出発 {step.departureTime}</span>
                    {point.travelTimeFromPrev != null && point.travelTimeFromPrev > 0 && !isFirst && (
                      <span className="text-slate-400">移動 {point.travelTimeFromPrev}分</span>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
