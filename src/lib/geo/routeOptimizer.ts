/**
 * ルート最適化（TSP: 巡回セールスマン問題）
 * GAS Application.js 844行目以降の最近傍法（Nearest Neighbor）を 100% 移植
 */

const EARTH_RADIUS_KM = 6371;

/** GAS DEFAULTS と同一 */
export const ROUTE_DEFAULTS = {
  TIME_PER_AREA: 30, // 分/反
  TIME_PER_KM: 1,    // 分/km
  START_HOUR: 9,
  START_MINUTE: 0,
} as const;

export interface FieldPoint {
  appId: string;
  fieldId: string;
  farmerId: string | null;
  area10r: number;
  lat: number;
  lng: number;
  fieldName: string;
  address: string;
  farmerName: string;
  travelTimeFromPrev?: number; // 分（計算後にセット）
}

/**
 * 2点間の距離を Haversine 公式で計算（km）
 * Utils.js calculateDistance と同一
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * 最近傍法で訪問順序を最適化
 * GAS optimizeRouteOrder(fieldPoints, baseLat, baseLng) と 100% 一致
 */
export function optimizeRouteOrder(
  fieldPoints: FieldPoint[],
  baseLat: number | null,
  baseLng: number | null,
  timePerKm: number = ROUTE_DEFAULTS.TIME_PER_KM
): FieldPoint[] {
  if (fieldPoints.length === 0) return [];
  if (fieldPoints.length === 1) {
    fieldPoints[0].travelTimeFromPrev = 0;
    return fieldPoints;
  }

  const optimized: FieldPoint[] = [];
  const remaining = [...fieldPoints];

  let currentPoint: FieldPoint;

  if (baseLat !== null && baseLng !== null) {
    let minDist = Infinity;
    let nearestIndex = 0;
    remaining.forEach((point, idx) => {
      const dist = calculateDistance(baseLat, baseLng, point.lat, point.lng);
      if (dist < minDist) {
        minDist = dist;
        nearestIndex = idx;
      }
    });
    currentPoint = remaining.splice(nearestIndex, 1)[0];
    currentPoint.travelTimeFromPrev = Math.ceil(minDist * timePerKm);
  } else {
    currentPoint = remaining.shift()!;
    currentPoint.travelTimeFromPrev = 0;
  }

  optimized.push(currentPoint);

  while (remaining.length > 0) {
    let minDist = Infinity;
    let nearestIndex = 0;

    remaining.forEach((point, idx) => {
      const dist = calculateDistance(
        currentPoint.lat,
        currentPoint.lng,
        point.lat,
        point.lng
      );
      if (dist < minDist) {
        minDist = dist;
        nearestIndex = idx;
      }
    });

    const nextPoint = remaining.splice(nearestIndex, 1)[0];
    nextPoint.travelTimeFromPrev = Math.ceil(minDist * timePerKm);
    optimized.push(nextPoint);
    currentPoint = nextPoint;
  }

  return optimized;
}

/**
 * 最適化ルートに対して到着・作業・出発時刻を計算（GAS の routeSheet 相当）
 */
export function buildRouteSchedule(
  optimizedRoute: FieldPoint[],
  workDate: string,
  timePerArea: number = ROUTE_DEFAULTS.TIME_PER_AREA,
  startHour: number = ROUTE_DEFAULTS.START_HOUR,
  startMinute: number = ROUTE_DEFAULTS.START_MINUTE
): { arrivalTime: string; workDuration: number; departureTime: string }[] {
  const start = new Date(
    `${workDate}T${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}:00`
  );
  const schedule: { arrivalTime: string; workDuration: number; departureTime: string }[] = [];
  let currentTime = new Date(start.getTime());

  optimizedRoute.forEach((point) => {
    const travelMs = (point.travelTimeFromPrev ?? 0) * 60 * 1000;
    const arrivalTime = new Date(currentTime.getTime() + travelMs);
    const workDuration = Math.ceil(point.area10r * timePerArea);
    const departureTime = new Date(arrivalTime.getTime() + workDuration * 60 * 1000);

    schedule.push({
      arrivalTime: formatTime(arrivalTime),
      workDuration,
      departureTime: formatTime(departureTime),
    });

    currentTime = departureTime;
  });

  return schedule;
}

function formatTime(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
