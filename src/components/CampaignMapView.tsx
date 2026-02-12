'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Polygon as GeoPolygon } from 'geojson';
import { parseCampaignPolygon } from '@/lib/geo/spatial-queries';
import type { Project } from '@/types/database';
import type { Field } from '@/types/database';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon.src,
  iconRetinaUrl: markerIcon2x.src,
  shadowUrl: markerShadow.src,
});

export interface CampaignWithPolygon extends Project {
  polygonGeoJSON?: GeoPolygon | null;
}

interface CampaignMapViewProps {
  campaigns: CampaignWithPolygon[];
  fields: Field[];
  /** ハイライトする案件ID（オプション） */
  highlightedCampaignId?: string | null;
  className?: string;
  style?: React.CSSProperties;
}

function FitBounds({ campaigns, fields }: { campaigns: CampaignWithPolygon[]; fields: Field[] }) {
  const map = useMap();
  useEffect(() => {
    const hasPolygon = campaigns.some((c) => c.polygonGeoJSON ?? parseCampaignPolygon(c.target_area_polygon));
    const hasField = fields.some((f) => f.lat != null && f.lng != null);
    if (!hasPolygon && !hasField) return;
    const bounds = new L.LatLngBounds([] as [number, number][]);
    campaigns.forEach((c) => {
      const poly = c.polygonGeoJSON ?? parseCampaignPolygon(c.target_area_polygon);
      if (poly?.coordinates?.[0]) {
        poly.coordinates[0].forEach(([lng, lat]) => bounds.extend([lat, lng]));
      }
    });
    fields.forEach((f) => {
      if (f.lat != null && f.lng != null) bounds.extend([f.lat, f.lng]);
    });
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 });
  }, [map, campaigns, fields]);
  return null;
}

export default function CampaignMapView({
  campaigns,
  fields,
  highlightedCampaignId,
  className = '',
  style = { height: '100%', minHeight: '400px', borderRadius: '0.5rem' },
}: CampaignMapViewProps) {
  const center: [number, number] = [35.6812, 139.7671];

  return (
    <MapContainer
      center={center}
      zoom={10}
      className={className}
      style={style}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.google.com/maps">Google</a>'
        url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
        maxZoom={20}
      />
      <FitBounds campaigns={campaigns} fields={fields} />

      {campaigns.map((campaign) => {
        const poly = campaign.polygonGeoJSON ?? parseCampaignPolygon(campaign.target_area_polygon);
        if (!poly?.coordinates?.[0]) return null;
        const positions: [number, number][] = poly.coordinates[0].map(([lng, lat]) => [lat, lng]);
        const isHighlighted = highlightedCampaignId === campaign.id;
        return (
          <Polygon
            key={campaign.id}
            positions={positions}
            pathOptions={{
              color: isHighlighted ? '#1A4731' : '#2d5a3d',
              fillColor: isHighlighted ? '#1A4731' : '#3d7a52',
              fillOpacity: isHighlighted ? 0.35 : 0.2,
              weight: isHighlighted ? 4 : 2,
            }}
            eventHandlers={{
              click: () => {},
            }}
          >
            <Popup>
              <span className="font-bold text-dashboard-text">
                {(campaign as { campaign_title?: string }).campaign_title || campaign.location}
              </span>
              {campaign.location && <p className="text-sm text-dashboard-muted mt-1">{campaign.location}</p>}
            </Popup>
          </Polygon>
        );
      })}

      {fields.map((field) => {
        if (field.lat == null || field.lng == null) return null;
        return (
          <Marker key={field.id} position={[field.lat, field.lng]}>
            <Popup>
              <span className="font-bold text-dashboard-text">{field.name || '（畑）'}</span>
              {field.address && <p className="text-sm text-dashboard-muted mt-1">{field.address}</p>}
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
