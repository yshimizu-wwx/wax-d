'use client';

import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, FeatureGroup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import { leafletLayerToGeoJSON, calculatePolygonArea10r } from '@/lib/geo/areaCalculator';
import type { Polygon } from 'geojson';

// Fix Leaflet's default icon path issues
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Import leaflet-draw side effects
import 'leaflet-draw';

// Fix icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconUrl: markerIcon.src,
    iconRetinaUrl: markerIcon2x.src,
    shadowUrl: markerShadow.src,
});

interface PolygonMapProps {
    onPolygonComplete: (coords: { lat: number; lng: number }[] | null, area10r: number, polygon: Polygon | null) => void;
    initialPolygon?: { lat: number; lng: number }[];
}

function MapController({ onPolygonComplete, initialPolygon }: PolygonMapProps) {
    const map = useMap();
    const drawnItemsRef = useRef<L.FeatureGroup>(new L.FeatureGroup());

    useEffect(() => {
        const drawnItems = drawnItemsRef.current;
        map.addLayer(drawnItems);

        // Add initial polygon if provided
        if (initialPolygon && initialPolygon.length > 2) {
            const polygon = L.polygon(initialPolygon, {
                color: '#1A4731',
                fillColor: '#1A4731',
                fillOpacity: 0.25,
                weight: 3
            });
            drawnItems.addLayer(polygon);
            map.fitBounds(polygon.getBounds());
        }

        // Initialize Draw Control
        const drawControl = new L.Control.Draw({
            draw: {
                polygon: {
                    allowIntersection: false,
                    showArea: true,
                    shapeOptions: {
                        color: '#1A4731',
                        fillColor: '#1A4731',
                        fillOpacity: 0.25,
                        weight: 3
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
        map.on(L.Draw.Event.CREATED, (e: any) => {
            const layer = e.layer;
            drawnItems.clearLayers(); // Only allow one polygon
            drawnItems.addLayer(layer);

            const latlngs = layer.getLatLngs()[0] as { lat: number, lng: number }[];
            // Convert to array of {lat, lng} objects if needed, Leaflet usually returns LatLng objects
            const coords = latlngs.map(ll => ({ lat: ll.lat, lng: ll.lng }));

            // Use the proper geo calculator with Turf.js
            const polygon = leafletLayerToGeoJSON(layer);
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
    return (
        <MapContainer
            center={[35.6812, 139.7671]} // Tokyo default
            zoom={15}
            style={{ height: '100%', width: '100%', minHeight: '400px', borderRadius: '0.5rem' }}
        >
            <TileLayer
                attribution='&copy; <a href="https://www.google.com/maps">Google</a>'
                url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" // Google Hybrid
                maxZoom={20}
            />
            <MapController {...props} />
        </MapContainer>
    );
}
