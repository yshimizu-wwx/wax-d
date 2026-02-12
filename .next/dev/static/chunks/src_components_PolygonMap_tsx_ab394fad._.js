(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/components/PolygonMap.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>PolygonMap
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$leaflet$2f$lib$2f$MapContainer$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react-leaflet/lib/MapContainer.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$leaflet$2f$lib$2f$TileLayer$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react-leaflet/lib/TileLayer.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$leaflet$2f$lib$2f$hooks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react-leaflet/lib/hooks.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/leaflet/dist/leaflet-src.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$geo$2f$areaCalculator$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/geo/areaCalculator.ts [app-client] (ecmascript)");
// Fix Leaflet's default icon path issues
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$images$2f$marker$2d$icon$2d$2x$2e$png__$28$static__in__ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/leaflet/dist/images/marker-icon-2x.png (static in ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$images$2f$marker$2d$icon$2e$png__$28$static__in__ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/leaflet/dist/images/marker-icon.png (static in ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$images$2f$marker$2d$shadow$2e$png__$28$static__in__ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/leaflet/dist/images/marker-shadow.png (static in ecmascript)");
// Import leaflet-draw side effects
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2d$draw$2f$dist$2f$leaflet$2e$draw$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/leaflet-draw/dist/leaflet.draw.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
;
;
;
;
;
;
// Fix icons
delete __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].Icon.Default.prototype._getIconUrl;
__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].Icon.Default.mergeOptions({
    iconUrl: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$images$2f$marker$2d$icon$2e$png__$28$static__in__ecmascript$29$__["default"].src,
    iconRetinaUrl: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$images$2f$marker$2d$icon$2d$2x$2e$png__$28$static__in__ecmascript$29$__["default"].src,
    shadowUrl: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$images$2f$marker$2d$shadow$2e$png__$28$static__in__ecmascript$29$__["default"].src
});
function MapController({ onPolygonComplete, initialPolygon }) {
    _s();
    const map = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$leaflet$2f$lib$2f$hooks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMap"])();
    const drawnItemsRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].FeatureGroup());
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "MapController.useEffect": ()=>{
            const drawnItems = drawnItemsRef.current;
            map.addLayer(drawnItems);
            // Add initial polygon if provided
            if (initialPolygon && initialPolygon.length > 2) {
                const polygon = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].polygon(initialPolygon, {
                    color: '#10b981',
                    fillColor: '#10b981',
                    fillOpacity: 0.2,
                    weight: 2
                });
                drawnItems.addLayer(polygon);
                map.fitBounds(polygon.getBounds());
            }
            // Initialize Draw Control
            const drawControl = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].Control.Draw({
                draw: {
                    polygon: {
                        allowIntersection: false,
                        showArea: true,
                        shapeOptions: {
                            color: '#10b981',
                            fillColor: '#10b981',
                            fillOpacity: 0.2,
                            weight: 2
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
            map.on(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].Draw.Event.CREATED, {
                "MapController.useEffect": (e)=>{
                    const layer = e.layer;
                    drawnItems.clearLayers(); // Only allow one polygon
                    drawnItems.addLayer(layer);
                    const latlngs = layer.getLatLngs()[0];
                    // Convert to array of {lat, lng} objects if needed, Leaflet usually returns LatLng objects
                    const coords = latlngs.map({
                        "MapController.useEffect.coords": (ll)=>({
                                lat: ll.lat,
                                lng: ll.lng
                            })
                    }["MapController.useEffect.coords"]);
                    // Use the proper geo calculator with Turf.js
                    const polygon = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$geo$2f$areaCalculator$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["leafletLayerToGeoJSON"])(layer);
                    const area10r = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$geo$2f$areaCalculator$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculatePolygonArea10r"])(polygon);
                    onPolygonComplete(coords, area10r, polygon);
                }
            }["MapController.useEffect"]);
            map.on(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].Draw.Event.DELETED, {
                "MapController.useEffect": ()=>{
                    onPolygonComplete(null, 0, null);
                }
            }["MapController.useEffect"]);
            return ({
                "MapController.useEffect": ()=>{
                    map.removeControl(drawControl);
                    map.removeLayer(drawnItems);
                    // clean up event listeners
                    map.off(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].Draw.Event.CREATED);
                    map.off(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].Draw.Event.DELETED);
                }
            })["MapController.useEffect"];
        }
    }["MapController.useEffect"], [
        map,
        onPolygonComplete,
        initialPolygon
    ]);
    return null;
}
_s(MapController, "EQFLR9AsIoDy5V2W9qZoahcFQ9Y=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$leaflet$2f$lib$2f$hooks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMap"]
    ];
});
_c = MapController;
function PolygonMap(props) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$leaflet$2f$lib$2f$MapContainer$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MapContainer"], {
        center: [
            35.6812,
            139.7671
        ],
        zoom: 15,
        style: {
            height: '100%',
            width: '100%',
            minHeight: '400px',
            borderRadius: '0.5rem'
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$leaflet$2f$lib$2f$TileLayer$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TileLayer"], {
                attribution: '© <a href="https://www.google.com/maps">Google</a>',
                url: "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
                maxZoom: 20
            }, void 0, false, {
                fileName: "[project]/src/components/PolygonMap.tsx",
                lineNumber: 120,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(MapController, {
                ...props
            }, void 0, false, {
                fileName: "[project]/src/components/PolygonMap.tsx",
                lineNumber: 125,
                columnNumber: 13
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/PolygonMap.tsx",
        lineNumber: 115,
        columnNumber: 9
    }, this);
}
_c1 = PolygonMap;
var _c, _c1;
__turbopack_context__.k.register(_c, "MapController");
__turbopack_context__.k.register(_c1, "PolygonMap");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/PolygonMap.tsx [app-client] (ecmascript, next/dynamic entry)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/src/components/PolygonMap.tsx [app-client] (ecmascript)"));
}),
]);

//# sourceMappingURL=src_components_PolygonMap_tsx_ab394fad._.js.map