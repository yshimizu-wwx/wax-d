(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/lib/calculator/priceCalculator.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 逆オークション方式の単価計算ロジック
 *
 * GAS版の Calculator.js:23 - calculateCurrentUnitPrice の完全移植
 * 参照: current_system_spec.md:295-358
 */ __turbopack_context__.s([
    "calculateCurrentUnitPrice",
    ()=>calculateCurrentUnitPrice,
    "calculateFinalAmount",
    ()=>calculateFinalAmount,
    "calculateTax",
    ()=>calculateTax,
    "getNextPriceMilestone",
    ()=>getNextPriceMilestone,
    "validateApplicationArea",
    ()=>validateApplicationArea
]);
function calculateCurrentUnitPrice(pricing, totalArea10r) {
    const { base_price, min_price, target_area_10r, min_target_area_10r = 0, max_target_area_10r, execution_price } = pricing;
    // 入力値の検証
    if (base_price < min_price) {
        throw new Error('開始単価は目標単価以上である必要があります');
    }
    if (totalArea10r < 0) {
        throw new Error('申込合計面積は0以上である必要があります');
    }
    // パターンA: 最低成立面積がある場合
    if (min_target_area_10r > 0 && max_target_area_10r && max_target_area_10r > 0 && execution_price) {
        return calculateWithMinimumArea(pricing, totalArea10r);
    }
    // パターンB: 従来の線形方式
    return calculateLinearPrice(pricing, totalArea10r);
}
/**
 * パターンA: 最低成立面積がある場合の計算
 * @private
 */ function calculateWithMinimumArea(pricing, totalArea10r) {
    const { base_price, min_price, min_target_area_10r, max_target_area_10r, execution_price } = pricing;
    // ケース1: 最低成立面積未達
    if (totalArea10r < min_target_area_10r) {
        const progress = totalArea10r / min_target_area_10r;
        const remainingArea = min_target_area_10r - totalArea10r;
        return {
            currentPrice: null,
            progress,
            isUnformed: true,
            priceReduction: 0,
            remainingArea,
            nextMilestoneArea: remainingArea
        };
    }
    // ケース2: 満額ライン達成
    if (totalArea10r >= max_target_area_10r) {
        return {
            currentPrice: Math.round(min_price),
            progress: 1.0,
            isUnformed: false,
            priceReduction: base_price - min_price,
            remainingArea: 0,
            nextMilestoneArea: 0
        };
    }
    // ケース3: 最低成立〜満額ラインの間（線形変動）
    const progressRange = max_target_area_10r - min_target_area_10r;
    const currentRange = totalArea10r - min_target_area_10r;
    const progress = currentRange / progressRange;
    const priceRange = min_price - execution_price;
    const currentPrice = execution_price + priceRange * progress;
    const remainingArea = max_target_area_10r - totalArea10r;
    return {
        currentPrice: Math.round(currentPrice),
        progress,
        isUnformed: false,
        priceReduction: base_price - currentPrice,
        remainingArea,
        nextMilestoneArea: remainingArea
    };
}
/**
 * パターンB: 従来の線形方式の計算
 * @private
 */ function calculateLinearPrice(pricing, totalArea10r) {
    const { base_price, min_price, target_area_10r } = pricing;
    const progress = Math.min(totalArea10r / target_area_10r, 1.0);
    const priceRange = base_price - min_price;
    const currentPrice = base_price - priceRange * progress;
    const remainingArea = Math.max(0, target_area_10r - totalArea10r);
    return {
        currentPrice: Math.round(currentPrice),
        progress,
        isUnformed: false,
        priceReduction: base_price - currentPrice,
        remainingArea,
        nextMilestoneArea: remainingArea > 0 ? remainingArea : undefined
    };
}
function calculateFinalAmount(unitPrice, actualArea10r) {
    if (unitPrice < 0 || actualArea10r < 0) {
        throw new Error('単価と実績面積は0以上である必要があります');
    }
    return Math.round(unitPrice * actualArea10r);
}
function calculateTax(amountExTax, taxRate = 10) {
    if (amountExTax < 0) {
        throw new Error('税抜金額は0以上である必要があります');
    }
    if (taxRate < 0 || taxRate > 100) {
        throw new Error('消費税率は0〜100%の範囲である必要があります');
    }
    const taxAmount = Math.round(amountExTax * (taxRate / 100));
    const amountInclusive = amountExTax + taxAmount;
    return {
        amountExTax,
        taxAmount,
        amountInclusive,
        taxRate
    };
}
function validateApplicationArea(requestedArea10r, currentTotalArea10r, maxArea10r) {
    if (requestedArea10r <= 0) {
        return {
            isValid: false,
            errorMessage: '申込面積は1反以上である必要があります',
            currentTotalArea: currentTotalArea10r,
            remainingArea: maxArea10r - currentTotalArea10r,
            maxArea: maxArea10r
        };
    }
    const remainingArea = maxArea10r - currentTotalArea10r;
    if (requestedArea10r > remainingArea) {
        return {
            isValid: false,
            errorMessage: `申し込み面積が上限を超えています。残り ${remainingArea.toFixed(1)} 反まで予約可能です。`,
            currentTotalArea: currentTotalArea10r,
            remainingArea,
            maxArea: maxArea10r
        };
    }
    return {
        isValid: true,
        currentTotalArea: currentTotalArea10r,
        remainingArea,
        maxArea: maxArea10r
    };
}
function getNextPriceMilestone(pricing, totalArea10r) {
    const { min_price, min_target_area_10r = 0, max_target_area_10r, execution_price } = pricing;
    // パターンA: 最低成立面積がある場合
    if (min_target_area_10r > 0 && max_target_area_10r && execution_price) {
        if (totalArea10r < min_target_area_10r) {
            return {
                nextMilestoneArea: min_target_area_10r,
                nextPrice: execution_price,
                description: '最低成立面積達成で成立時単価が適用されます'
            };
        }
        if (totalArea10r < max_target_area_10r) {
            return {
                nextMilestoneArea: max_target_area_10r,
                nextPrice: min_price,
                description: '満額ライン達成で目標単価が適用されます'
            };
        }
        return {
            nextMilestoneArea: null,
            nextPrice: null,
            description: '満額ライン達成済み'
        };
    }
    // パターンB: 従来の線形方式
    const { target_area_10r } = pricing;
    if (totalArea10r < target_area_10r) {
        return {
            nextMilestoneArea: target_area_10r,
            nextPrice: min_price,
            description: '目標面積達成で目標単価が適用されます'
        };
    }
    return {
        nextMilestoneArea: null,
        nextPrice: null,
        description: '目標面積達成済み'
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/supabase.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "supabase",
    ()=>supabase
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@supabase/supabase-js/dist/index.mjs [app-client] (ecmascript) <locals>");
;
const supabaseUrl = ("TURBOPACK compile-time value", "https://ayvieorwnyxxfygbhzny.supabase.co");
const supabaseAnonKey = ("TURBOPACK compile-time value", "sb_publishable_saY21TLJVLBNk5lg53j5Pg_PW9RAlEr");
const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["createClient"])(supabaseUrl, supabaseAnonKey);
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/geo/areaCalculator.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AREA_CONSTANTS",
    ()=>AREA_CONSTANTS,
    "calculateDistance",
    ()=>calculateDistance,
    "calculatePolygonArea10r",
    ()=>calculatePolygonArea10r,
    "coordinatesToPolygon",
    ()=>coordinatesToPolygon,
    "geoJSONToWKT",
    ()=>geoJSONToWKT,
    "getPolygonCenter",
    ()=>getPolygonCenter,
    "leafletLayerToGeoJSON",
    ()=>leafletLayerToGeoJSON,
    "polygonsOverlap",
    ()=>polygonsOverlap,
    "simplifyPolygon",
    ()=>simplifyPolygon,
    "validatePolygon",
    ()=>validatePolygon,
    "wktToGeoJSON",
    ()=>wktToGeoJSON
]);
/**
 * 地図・面積計算ロジック
 *
 * Turf.jsを使用してポリゴンの面積を「反（10R）」単位で計算
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$turf$2f$area$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@turf/area/dist/esm/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$turf$2f$helpers$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@turf/helpers/dist/esm/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$turf$2f$distance$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@turf/distance/dist/esm/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$turf$2f$center$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@turf/center/dist/esm/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$turf$2f$simplify$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@turf/simplify/dist/esm/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$turf$2f$kinks$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@turf/kinks/dist/esm/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$turf$2f$intersect$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@turf/intersect/dist/esm/index.js [app-client] (ecmascript)");
;
const AREA_CONSTANTS = {
    /** 1坪 = 3.305785㎡ */ TSUBO_TO_SQUARE_METER: 3.305785,
    /** 1反 = 300坪 */ TAN_TO_TSUBO: 300,
    /** 1反 = 991.7355㎡ */ TAN_TO_SQUARE_METER: 991.7355,
    /** 1ヘクタール = 10反 */ HECTARE_TO_TAN: 10
};
function calculatePolygonArea10r(polygon) {
    // Turf.jsで面積を平方メートルで計算（測地線計算）
    const areaInSquareMeters = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$turf$2f$area$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["area"](polygon);
    // 1反 = 991.7355㎡ で換算
    const area10r = areaInSquareMeters / AREA_CONSTANTS.TAN_TO_SQUARE_METER;
    // 小数点第2位で四捨五入
    return Math.round(area10r * 100) / 100;
}
function coordinatesToPolygon(coordinates) {
    // 始点と終点を一致させる（GeoJSON仕様）
    const coords = [
        ...coordinates
    ];
    // 既に閉じている場合はそのまま返す
    const isClosed = coords.length >= 4 && coords[0][0] === coords[coords.length - 1][0] && coords[0][1] === coords[coords.length - 1][1];
    if (!isClosed) {
        coords.push(coords[0]);
    }
    return {
        type: 'Polygon',
        coordinates: [
            coords
        ]
    };
}
function leafletLayerToGeoJSON(layer) {
    // Leafletのレイヤーから座標を取得
    const latLngs = layer.getLatLngs()[0]; // 外周のみ取得
    // [lng, lat]形式に変換
    const coordinates = latLngs.map((latLng)=>[
            latLng.lng,
            latLng.lat
        ]);
    return coordinatesToPolygon(coordinates);
}
function geoJSONToWKT(polygon) {
    const coords = polygon.coordinates[0].map(([lng, lat])=>`${lng} ${lat}`).join(', ');
    return `POLYGON((${coords}))`;
}
function wktToGeoJSON(wkt) {
    // "POLYGON((...))" から座標部分を抽出
    const coordsStr = wkt.replace(/^POLYGON\(\(/, '').replace(/\)\)$/, '');
    const coordinates = coordsStr.split(', ').map((pair)=>{
        const [lng, lat] = pair.split(' ').map(Number);
        return [
            lng,
            lat
        ];
    });
    return {
        type: 'Polygon',
        coordinates: [
            coordinates
        ]
    };
}
function calculateDistance(point1, point2) {
    const from = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$turf$2f$helpers$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["point"](point1);
    const to = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$turf$2f$helpers$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["point"](point2);
    // Turf.jsのdistance関数（デフォルトでkm単位）
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$turf$2f$distance$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["distance"](from, to, {
        units: 'kilometers'
    });
}
function getPolygonCenter(polygon) {
    const center = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$turf$2f$center$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["center"](polygon);
    return center.geometry.coordinates;
}
function simplifyPolygon(polygon, tolerance = 0.0001) {
    const feature = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$turf$2f$helpers$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["feature"](polygon);
    const simplified = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$turf$2f$simplify$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["simplify"](feature, {
        tolerance,
        highQuality: true
    });
    return simplified.geometry;
}
function validatePolygon(polygon) {
    try {
        // 最低3点（+ 始点の重複）= 4点必要
        if (polygon.coordinates[0].length < 4) {
            return {
                isValid: false,
                error: 'ポリゴンには最低3点の座標が必要です'
            };
        }
        // 始点と終点が一致しているか
        const first = polygon.coordinates[0][0];
        const last = polygon.coordinates[0][polygon.coordinates[0].length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
            return {
                isValid: false,
                error: '始点と終点が一致していません'
            };
        }
        // 自己交差チェック
        const kinks = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$turf$2f$kinks$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["kinks"](polygon);
        if (kinks.features.length > 0) {
            return {
                isValid: false,
                error: 'ポリゴンが自己交差しています'
            };
        }
        // 面積が0でないか
        const area = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$turf$2f$area$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["area"](polygon);
        if (area === 0) {
            return {
                isValid: false,
                error: 'ポリゴンの面積が0です'
            };
        }
        return {
            isValid: true
        };
    } catch (error) {
        return {
            isValid: false,
            error: error instanceof Error ? error.message : '不明なエラー'
        };
    }
}
function polygonsOverlap(polygon1, polygon2) {
    try {
        const feature1 = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$turf$2f$helpers$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["polygon"](polygon1.coordinates);
        const feature2 = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$turf$2f$helpers$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["polygon"](polygon2.coordinates);
        const intersection = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$turf$2f$intersect$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["intersect"](feature1, feature2);
        return intersection !== null && intersection !== undefined;
    } catch  {
        return false;
    }
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/api.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createBooking",
    ()=>createBooking,
    "fetchActiveProject",
    ()=>fetchActiveProject,
    "fetchCampaignTotalArea",
    ()=>fetchCampaignTotalArea,
    "fetchProjects",
    ()=>fetchProjects
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/supabase.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$geo$2f$areaCalculator$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/geo/areaCalculator.ts [app-client] (ecmascript)");
;
;
async function fetchProjects() {
    const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabase"].from('projects').select('*').eq('status', 'open').order('created_at', {
        ascending: false
    });
    if (error) {
        console.error('Error fetching projects:', error);
        return [];
    }
    return data || [];
}
async function fetchActiveProject() {
    const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabase"].from('projects').select('*').eq('status', 'open').eq('is_closed', false).order('created_at', {
        ascending: false
    }).limit(1).single();
    if (error) {
        // No active project found is not necessarily an error
        if (error.code === 'PGRST116') {
            console.log('No active project found');
            return null;
        }
        console.error('Error fetching active project:', error);
        return null;
    }
    return data;
}
async function fetchCampaignTotalArea(campaignId) {
    const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabase"].from('bookings').select('area_10r').eq('campaign_id', campaignId).neq('status', 'canceled');
    if (error) {
        console.error('Error fetching campaign total area:', error);
        return 0;
    }
    const total = data?.reduce((sum, booking)=>sum + (booking.area_10r || 0), 0) || 0;
    return total;
}
async function createBooking(bookingData) {
    try {
        // Convert GeoJSON polygon to WKT for PostGIS
        const polygonWKT = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$geo$2f$areaCalculator$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["geoJSONToWKT"])(bookingData.field_polygon);
        // Generate a unique ID (you might want to use UUID here)
        const bookingId = `BK_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabase"].from('bookings').insert({
            id: bookingId,
            campaign_id: bookingData.campaign_id,
            farmer_name: bookingData.farmer_name,
            phone: bookingData.phone,
            email: bookingData.email,
            desired_start_date: bookingData.desired_start_date,
            desired_end_date: bookingData.desired_end_date,
            field_polygon: polygonWKT,
            area_10r: bookingData.area_10r,
            locked_price: bookingData.locked_price,
            status: 'pending',
            applied_at: new Date().toISOString()
        }).select('id').single();
        if (error) {
            console.error('Error creating booking:', error);
            return {
                success: false,
                error: error.message
            };
        }
        return {
            success: true,
            bookingId: data?.id || bookingId
        };
    } catch (error) {
        console.error('Unexpected error creating booking:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/app/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Home
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$shared$2f$lib$2f$app$2d$dynamic$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/shared/lib/app-dynamic.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$calculator$2f$priceCalculator$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/calculator/priceCalculator.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api.ts [app-client] (ecmascript)");
;
;
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
// Dynamically import components to avoid SSR issues
const PolygonMap = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$shared$2f$lib$2f$app$2d$dynamic$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(()=>__turbopack_context__.A("[project]/src/components/PolygonMap.tsx [app-client] (ecmascript, next/dynamic entry, async loader)"), {
    loadableGenerated: {
        modules: [
            "[project]/src/components/PolygonMap.tsx [app-client] (ecmascript, next/dynamic entry)"
        ]
    },
    ssr: false,
    loading: ()=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "w-full h-full bg-slate-100 animate-pulse rounded-2xl flex items-center justify-center text-slate-400",
            children: "地図を読み込み中..."
        }, void 0, false, {
            fileName: "[project]/src/app/page.tsx",
            lineNumber: 15,
            columnNumber: 5
        }, ("TURBOPACK compile-time value", void 0))
});
_c = PolygonMap;
const CampaignForm = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$shared$2f$lib$2f$app$2d$dynamic$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(()=>__turbopack_context__.A("[project]/src/components/CampaignForm.tsx [app-client] (ecmascript, next/dynamic entry, async loader)"), {
    loadableGenerated: {
        modules: [
            "[project]/src/components/CampaignForm.tsx [app-client] (ecmascript, next/dynamic entry)"
        ]
    },
    ssr: false
});
_c1 = CampaignForm;
function Home() {
    _s();
    const [project, setProject] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [area10r, setArea10r] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    const [polygon, setPolygon] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [coords, setCoords] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [totalCampaignArea, setTotalCampaignArea] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    // Load active project and total area on mount
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Home.useEffect": ()=>{
            async function loadProject() {
                const activeProject = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fetchActiveProject"])();
                setProject(activeProject);
                if (activeProject) {
                    const totalArea = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fetchCampaignTotalArea"])(activeProject.id);
                    setTotalCampaignArea(totalArea);
                }
                setLoading(false);
            }
            loadProject();
        }
    }["Home.useEffect"], []);
    const handlePolygonComplete = (newCoords, newArea10r, newPolygon)=>{
        setCoords(newCoords);
        setArea10r(newArea10r);
        setPolygon(newPolygon);
    };
    const handleFormSubmit = async (formData)=>{
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
            execution_price: project.execution_price
        };
        const simulatedTotalArea = totalCampaignArea + area10r;
        const validation = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$calculator$2f$priceCalculator$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateCurrentUnitPrice"])(pricing, simulatedTotalArea);
        const lockedPrice = validation.currentPrice ?? project.base_price ?? 0;
        const bookingData = {
            campaign_id: project.id,
            farmer_name: formData.farmerName,
            phone: formData.phone,
            email: formData.email,
            desired_start_date: formData.desiredStartDate,
            desired_end_date: formData.desiredEndDate,
            field_polygon: polygon,
            area_10r: area10r,
            locked_price: lockedPrice
        };
        const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createBooking"])(bookingData);
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
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
            className: "min-h-screen bg-slate-50 flex items-center justify-center",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "text-center",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto mb-4"
                    }, void 0, false, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 110,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-slate-600 font-medium",
                        children: "読み込み中..."
                    }, void 0, false, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 111,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/page.tsx",
                lineNumber: 109,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/src/app/page.tsx",
            lineNumber: 108,
            columnNumber: 7
        }, this);
    }
    if (!project) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
            className: "min-h-screen bg-slate-50 flex items-center justify-center p-4",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "bg-white p-8 rounded-2xl shadow-lg border border-slate-200 max-w-md text-center",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-6xl mb-4",
                        children: "🌾"
                    }, void 0, false, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 121,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                        className: "text-2xl font-bold text-slate-800 mb-2",
                        children: "現在募集中の案件はありません"
                    }, void 0, false, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 122,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-slate-600",
                        children: "新しい案件が開始されるまでお待ちください。"
                    }, void 0, false, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 123,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/page.tsx",
                lineNumber: 120,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/src/app/page.tsx",
            lineNumber: 119,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        className: "min-h-screen bg-gradient-to-br from-slate-50 to-green-50/30",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                className: "bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                        className: "text-2xl md:text-3xl font-black text-slate-800 tracking-tight",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-green-600 mr-2",
                                                children: "🌾 Wayfinder"
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/page.tsx",
                                                lineNumber: 137,
                                                columnNumber: 17
                                            }, this),
                                            "AgriX"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/app/page.tsx",
                                        lineNumber: 136,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-slate-500 text-sm font-medium mt-1",
                                        children: "農作業予約システム"
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/page.tsx",
                                        lineNumber: 139,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/app/page.tsx",
                                lineNumber: 135,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center gap-3",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-blue-700 font-bold text-xs",
                                            children: [
                                                "累計: ",
                                                totalCampaignArea.toFixed(1),
                                                " 反"
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/app/page.tsx",
                                            lineNumber: 143,
                                            columnNumber: 17
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/page.tsx",
                                        lineNumber: 142,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center gap-2 bg-green-50 px-4 py-2 rounded-full border border-green-200",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "w-2 h-2 bg-green-500 rounded-full animate-pulse"
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/page.tsx",
                                                lineNumber: 148,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-green-700 font-bold text-sm",
                                                children: "募集中"
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/page.tsx",
                                                lineNumber: 149,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/app/page.tsx",
                                        lineNumber: 147,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/app/page.tsx",
                                lineNumber: 141,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 134,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/src/app/page.tsx",
                    lineNumber: 133,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/app/page.tsx",
                lineNumber: 132,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid grid-cols-1 lg:grid-cols-2 gap-6",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                                className: "order-2 lg:order-1",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "bg-white p-4 rounded-2xl shadow-sm border border-slate-200 h-[500px] lg:h-[700px] relative",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "absolute top-6 left-6 z-[1000] bg-white/95 backdrop-blur px-4 py-2 rounded-xl shadow-md border border-slate-200",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                                    className: "text-sm font-bold text-slate-600 mb-1",
                                                    children: "圃場を描画"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/app/page.tsx",
                                                    lineNumber: 163,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-xs text-slate-500",
                                                    children: "地図上でクリックして圃場の範囲を指定"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/app/page.tsx",
                                                    lineNumber: 164,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/app/page.tsx",
                                            lineNumber: 162,
                                            columnNumber: 15
                                        }, this),
                                        area10r > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "absolute top-6 right-6 z-[1000] bg-green-600 text-white px-5 py-3 rounded-xl shadow-lg border-2 border-green-500 min-w-[180px]",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "text-xs font-bold uppercase tracking-wider mb-1 opacity-90",
                                                    children: "選択面積"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/app/page.tsx",
                                                    lineNumber: 170,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "text-3xl font-black",
                                                    children: [
                                                        area10r.toFixed(2),
                                                        " ",
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: "text-sm font-normal opacity-90",
                                                            children: "反"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/app/page.tsx",
                                                            lineNumber: 172,
                                                            columnNumber: 42
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/src/app/page.tsx",
                                                    lineNumber: 171,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/src/app/page.tsx",
                                            lineNumber: 169,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "w-full h-full rounded-xl overflow-hidden",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(PolygonMap, {
                                                onPolygonComplete: handlePolygonComplete,
                                                initialPolygon: coords || undefined
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/page.tsx",
                                                lineNumber: 178,
                                                columnNumber: 17
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/page.tsx",
                                            lineNumber: 177,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/app/page.tsx",
                                    lineNumber: 161,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/app/page.tsx",
                                lineNumber: 160,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                                className: "order-1 lg:order-2",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "bg-white p-6 rounded-2xl shadow-sm border border-slate-200",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CampaignForm, {
                                        project: project,
                                        area10r: area10r,
                                        totalCampaignArea: totalCampaignArea,
                                        onSubmit: handleFormSubmit
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/page.tsx",
                                        lineNumber: 189,
                                        columnNumber: 15
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/src/app/page.tsx",
                                    lineNumber: 188,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/app/page.tsx",
                                lineNumber: 187,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 157,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("footer", {
                        className: "mt-8 text-center text-sm text-slate-500",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            children: "ご不明な点がございましたら、お気軽にお問い合わせください。"
                        }, void 0, false, {
                            fileName: "[project]/src/app/page.tsx",
                            lineNumber: 202,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/app/page.tsx",
                        lineNumber: 201,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/page.tsx",
                lineNumber: 156,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/app/page.tsx",
        lineNumber: 130,
        columnNumber: 5
    }, this);
}
_s(Home, "3s/6QiH9InKTtSpYRVq4tQaGKt8=");
_c2 = Home;
var _c, _c1, _c2;
__turbopack_context__.k.register(_c, "PolygonMap");
__turbopack_context__.k.register(_c1, "CampaignForm");
__turbopack_context__.k.register(_c2, "Home");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=src_61808e2d._.js.map