'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, FeatureGroup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import { leafletLayerToGeoJSON, calculatePolygonArea10r, type LeafletDrawLayer } from '@/lib/geo/areaCalculator';
import { geocodeAddressViaApi } from '@/lib/geo/geocodeClient';
import { useGeolocation } from '@/hooks/useGeolocation';
import type { Polygon } from 'geojson';

// Fix Leaflet's default icon path issues
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Import leaflet-draw side effects
import 'leaflet-draw';

/** Leaflet.draw のツールバー・ツールチップを日本語に */
function setLeafletDrawJapanese() {
  if (typeof L === 'undefined' || !L.drawLocal) return;
  L.drawLocal.draw.toolbar.actions = { title: '描画をキャンセル', text: 'キャンセル' };
  L.drawLocal.draw.toolbar.finish = { title: '描画を完了', text: '完了' };
  L.drawLocal.draw.toolbar.undo = { title: '最後の点を削除', text: '最後の点を削除' };
  L.drawLocal.draw.toolbar.buttons.polygon = '畑の範囲を描く';
  L.drawLocal.draw.handlers.polygon.tooltip.start = 'クリックして範囲の描画を開始';
  L.drawLocal.draw.handlers.polygon.tooltip.cont = 'クリックして続けて描く';
  L.drawLocal.draw.handlers.polygon.tooltip.end = '最初の点をクリックして形を閉じる';
  L.drawLocal.edit.toolbar.actions.save = { title: '変更を保存', text: '保存' };
  L.drawLocal.edit.toolbar.actions.cancel = { title: '編集をキャンセル', text: 'キャンセル' };
  L.drawLocal.edit.toolbar.actions.clearAll = { title: 'すべてクリア', text: 'すべてクリア' };
  L.drawLocal.edit.toolbar.buttons.edit = '範囲を編集';
  L.drawLocal.edit.toolbar.buttons.editDisabled = '編集する範囲がありません';
  L.drawLocal.edit.toolbar.buttons.remove = '範囲を削除';
  L.drawLocal.edit.toolbar.buttons.removeDisabled = '削除する範囲がありません';
  L.drawLocal.edit.handlers.edit.tooltip.text = 'ハンドルをドラッグして編集';
  L.drawLocal.edit.handlers.edit.tooltip.subtext = 'キャンセルで元に戻します';
  L.drawLocal.edit.handlers.remove.tooltip.text = 'クリックして削除';
}

// Fix icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconUrl: markerIcon.src,
    iconRetinaUrl: markerIcon2x.src,
    shadowUrl: markerShadow.src,
});

const DEFAULT_CENTER: [number, number] = [35.6812, 139.7671];

/** 参照用ポリゴン1つ（依頼された畑など、編集不可で表示する枠） */
export type ReferencePolygon = { lat: number; lng: number }[];

interface PolygonMapProps {
    onPolygonComplete: (coords: { lat: number; lng: number }[] | null, area10r: number, polygon: Polygon | null) => void;
    initialPolygon?: { lat: number; lng: number }[];
    /** 参照用ポリゴン（複数可）。依頼された畑などを編集不可で表示する。 */
    referencePolygons?: ReferencePolygon[];
    /** 地図の初期中心（拠点座標）。未指定時は initialAddress をジオコードするか東京駅周辺 */
    initialCenter?: [number, number];
    /** 拠点住所。initialCenter が無い場合にジオコードして初期表示に使用 */
    initialAddress?: string | null;
    /** 住所検索バーを表示し、検索で地図を移動できるようにする */
    showAddressSearch?: boolean;
    /** 住所検索（地図を移動）成功時に、取得した住所・座標を親に渡す */
    onAddressSearchResult?: (address: string | undefined, lat: number, lng: number) => void;
}

interface MapControllerProps extends PolygonMapProps {
    flyTo?: [number, number] | null;
}

/** 依頼された畑の参照枠：赤で視認しやすく */
const REFERENCE_POLYGON_STYLE = {
    color: '#dc2626',
    fillColor: '#ef4444',
    fillOpacity: 0.35,
    weight: 3,
    dashArray: ''
};

function MapController({ onPolygonComplete, initialPolygon, referencePolygons, flyTo }: MapControllerProps) {
    const map = useMap();
    const drawnItemsRef = useRef<L.FeatureGroup>(new L.FeatureGroup());
    const referenceLayerRef = useRef<L.FeatureGroup>(new L.FeatureGroup());
    const prevFlyToRef = useRef<string | null>(null);

    useEffect(() => {
        if (!flyTo) return;
        const key = `${flyTo[0]},${flyTo[1]}`;
        if (prevFlyToRef.current === key) return;
        prevFlyToRef.current = key;
        map.flyTo([flyTo[0], flyTo[1]], 15, { duration: 0.5 });
    }, [map, flyTo]);

    // 参照用ポリゴン（依頼された畑など）を別レイヤーで表示
    useEffect(() => {
        const refLayer = referenceLayerRef.current;
        refLayer.clearLayers();
        map.addLayer(refLayer);

        const polygons = referencePolygons ?? [];
        if (polygons.length > 0) {
            let bounds: L.LatLngBounds | null = null;
            polygons.forEach((coords) => {
                if (coords.length > 2) {
                    const layer = L.polygon(coords, REFERENCE_POLYGON_STYLE);
                    refLayer.addLayer(layer);
                    const b = layer.getBounds();
                    if (!bounds) bounds = b;
                    else bounds.extend(b);
                }
            });
            // 参照ポリゴンのみがある場合（initialPolygon は別 effect で後から入る可能性あり）、一旦範囲を合わせる
            if (bounds && !initialPolygon?.length) {
                map.fitBounds(bounds, { padding: [24, 24], maxZoom: 16 });
            }
        }

        return () => {
            map.removeLayer(refLayer);
        };
    }, [map, referencePolygons, initialPolygon?.length]);

    useEffect(() => {
        const drawnItems = drawnItemsRef.current;
        drawnItems.clearLayers();
        map.addLayer(drawnItems);

        setLeafletDrawJapanese();

        // Add initial polygon if provided
        let boundsToFit: L.LatLngBounds | null = null;
        if (initialPolygon && initialPolygon.length > 2) {
            const polygon = L.polygon(initialPolygon, {
                color: '#DC2626',
                fillColor: '#DC2626',
                fillOpacity: 0.45,
                weight: 4
            });
            drawnItems.addLayer(polygon);
            boundsToFit = polygon.getBounds();
        }

        if (boundsToFit) {
            map.fitBounds(boundsToFit, { padding: [24, 24], maxZoom: 16 });
        }

        // Initialize Draw Control
        const drawControl = new L.Control.Draw({
            draw: {
                polygon: {
                    allowIntersection: false,
                    showArea: true,
                    shapeOptions: {
                        color: '#DC2626',
                        fillColor: '#DC2626',
                        fillOpacity: 0.45,
                        weight: 4
                    }
                },
                rectangle: false,
                circle: false,
                marker: false,
                polyline: false,
                circlemarker: false
            },
            edit: {
                featureGroup: drawnItems,
                remove: true,
                edit: false // Simplified for this demo
            }
        });

        map.addControl(drawControl);

        // Event Handlers
        map.on(L.Draw.Event.CREATED, (e: L.LeafletEvent & { layer: L.Layer }) => {
            const layer = e.layer;
            drawnItems.clearLayers(); // Only allow one polygon
            drawnItems.addLayer(layer);

            const latlngs = layer.getLatLngs()[0] as { lat: number; lng: number }[];
            const coords = latlngs.map((ll) => ({ lat: ll.lat, lng: ll.lng }));

            // Use the proper geo calculator with Turf.js（layer は getLatLngs を持つ draw レイヤー）
            const polygon = leafletLayerToGeoJSON(layer as unknown as LeafletDrawLayer);
            const area10r = calculatePolygonArea10r(polygon);

            onPolygonComplete(coords, area10r, polygon);
        });

        map.on(L.Draw.Event.DELETED, () => {
            onPolygonComplete(null, 0, null);
        });

        return () => {
            map.removeControl(drawControl);
            map.removeLayer(drawnItems);
            // clean up event listeners
            map.off(L.Draw.Event.CREATED);
            map.off(L.Draw.Event.DELETED);
        };
    }, [map, onPolygonComplete, initialPolygon]);

    return null;
}

export default function PolygonMap(props: PolygonMapProps) {
    const {
        initialCenter,
        initialAddress,
        showAddressSearch = false,
        onAddressSearchResult,
    } = props;

    const [flyToTarget, setFlyToTarget] = useState<[number, number] | null>(null);
    const [addressQuery, setAddressQuery] = useState('');
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [resolvedInitialCenter, setResolvedInitialCenter] = useState<[number, number] | null>(null);
    const [isFlying, setIsFlying] = useState(false);
    const initialAddressDone = useRef(false);
    const initialAddressSyncedRef = useRef(false);
    const { getCurrentPosition, loading: geoLoading, error: geoError, clearError: clearGeoError } = useGeolocation();

    const mapCenter = initialCenter ?? resolvedInitialCenter ?? DEFAULT_CENTER;
    const waitingInitialGeocode = !initialCenter && !!initialAddress?.trim() && resolvedInitialCenter === null;

    // 拠点住所を検索欄に反映（ユーザーがそのまま「地図を移動」できる）
    useEffect(() => {
        const addr = initialAddress?.trim();
        if (!addr || initialAddressSyncedRef.current) return;
        initialAddressSyncedRef.current = true;
        setAddressQuery(addr);
    }, [initialAddress]);

    useEffect(() => {
        if (!initialAddress?.trim() || initialCenter != null || initialAddressDone.current) return;
        initialAddressDone.current = true;
        geocodeAddressViaApi(initialAddress.trim()).then((result) => {
            if (result) {
                const coords: [number, number] = [result.lat, result.lng];
                setResolvedInitialCenter(coords);
                setFlyToTarget(coords);
                setIsFlying(true);
                setTimeout(() => setIsFlying(false), 600);
            } else {
                setResolvedInitialCenter(DEFAULT_CENTER);
            }
        });
    }, [initialAddress, initialCenter]);

    const handleAddressSearch = useCallback(async () => {
        const q = addressQuery.trim();
        if (!q) return;
        setSearchLoading(true);
        setSearchError(null);
        clearGeoError();
        try {
            const result = await geocodeAddressViaApi(q);
            if (result) {
                setFlyToTarget([result.lat, result.lng]);
                setIsFlying(true);
                setTimeout(() => setIsFlying(false), 600);
                // 検索結果の住所・座標を親に渡し、フォームの「住所・場所」に同期
                onAddressSearchResult?.(result.displayName ?? q, result.lat, result.lng);
            } else {
                setSearchError('住所が見つかりませんでした。別のキーワードで試してください。');
            }
        } catch {
            setSearchError('検索に失敗しました。しばらくしてから再試行してください。');
        } finally {
            setSearchLoading(false);
        }
    }, [addressQuery, clearGeoError, onAddressSearchResult]);

    const handleCurrentLocation = useCallback(async () => {
        setSearchError(null);
        clearGeoError();
        const pos = await getCurrentPosition();
        if (pos) {
            setFlyToTarget([pos.lat, pos.lng]);
            setIsFlying(true);
            setTimeout(() => setIsFlying(false), 600);
        }
    }, [getCurrentPosition, clearGeoError]);

    return (
        <div className="w-full h-full flex flex-col min-h-0">
            {showAddressSearch && (
                <div className="shrink-0 flex flex-wrap gap-2 mb-2">
                    <input
                        type="text"
                        value={addressQuery}
                        onChange={(e) => { setAddressQuery(e.target.value); setSearchError(null); clearGeoError(); }}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddressSearch())}
                        placeholder="住所で検索（例: 東京都千代田区）"
                        className="flex-1 min-w-[160px] px-3 py-2 text-sm bg-dashboard-bg border border-dashboard-border rounded-lg outline-none focus:ring-2 focus:ring-agrix-forest text-dashboard-text placeholder:text-dashboard-muted"
                    />
                    <button
                        type="button"
                        onClick={handleAddressSearch}
                        disabled={searchLoading}
                        className="px-4 py-2 text-sm font-medium rounded-lg bg-agrix-forest hover:bg-agrix-forest-dark text-white disabled:opacity-50"
                    >
                        {searchLoading ? '検索中...' : '地図を移動'}
                    </button>
                    <button
                        type="button"
                        onClick={handleCurrentLocation}
                        disabled={geoLoading}
                        className="px-4 py-2 text-sm font-medium rounded-lg border border-dashboard-border bg-dashboard-card hover:bg-dashboard-bg text-dashboard-text disabled:opacity-50"
                        title="現在地へ移動"
                    >
                        {geoLoading ? '取得中...' : '現在地'}
                    </button>
                    {(searchError || geoError) && (
                        <p className="w-full text-xs text-destructive">{searchError || geoError?.userFriendlyMessage}</p>
                    )}
                </div>
            )}
            <div className="flex-1 min-h-0 rounded-lg overflow-hidden relative">
                {waitingInitialGeocode ? (
                    <div className="w-full h-full min-h-[400px] rounded-lg bg-dashboard-card flex items-center justify-center text-dashboard-muted text-sm">
                        拠点住所から地図を読み込み中...
                    </div>
                ) : (
                    <>
                        <MapContainer
                            center={mapCenter}
                            zoom={15}
                            style={{ height: '100%', width: '100%', minHeight: '400px', borderRadius: '0.5rem' }}
                        >
                            <TileLayer
                                attribution='&copy; <a href="https://www.google.com/maps">Google</a>'
                                url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&hl=ja" // Google Hybrid（日本語表示）
                                maxZoom={20}
                            />
                            <MapController {...props} flyTo={flyToTarget} />
                        </MapContainer>
                        {isFlying && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none rounded-lg bg-black/20">
                                <span className="px-3 py-2 text-sm font-medium rounded-lg bg-dashboard-card text-dashboard-text shadow">
                                    移動中...
                                </span>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
