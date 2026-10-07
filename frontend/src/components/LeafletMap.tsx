import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

export interface MapMarkerItem {
  id: string;
  lat: number;
  lng: number;
  label: string;
  type: 'INCIDENT' | 'AMBULANCE' | 'HOSPITAL';
  details?: string;
}

export interface MapRouteItem {
  from: [number, number];
  to: [number, number];
  color?: string;
}

interface LeafletMapProps {
  markers?: MapMarkerItem[];
  routes?: MapRouteItem[];
  center?: [number, number];
  zoom?: number;
  height?: string;
  showLegend?: boolean;
}

export const LeafletMap: React.FC<LeafletMapProps> = ({
  markers = [],
  routes = [],
  center = [12.9716, 77.5946],
  zoom = 12,
  height = '340px',
  showLegend = true,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: center,
        zoom: zoom,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      layerGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    // Invalidate map size on window resize
    const handleResize = () => {
      mapInstanceRef.current?.invalidateSize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !layerGroupRef.current) return;

    const layerGroup = layerGroupRef.current;
    layerGroup.clearLayers();

    const bounds: L.LatLngBounds = L.latLngBounds([]);

    // Custom Emoji HTML Marker Icons
    const createCustomIcon = (type: 'INCIDENT' | 'AMBULANCE' | 'HOSPITAL') => {
      let iconHtml = '📍';
      let bgColor = 'rgba(239, 68, 68, 0.2)';
      let borderColor = '#ef4444';

      if (type === 'AMBULANCE') {
        iconHtml = '🚑';
        bgColor = 'rgba(59, 130, 246, 0.2)';
        borderColor = '#3b82f6';
      } else if (type === 'HOSPITAL') {
        iconHtml = '🏥';
        bgColor = 'rgba(16, 185, 129, 0.2)';
        borderColor = '#10b981';
      }

      return L.divIcon({
        className: 'custom-leaflet-marker',
        html: `<div style="background-color: ${bgColor}; border: 2px solid ${borderColor}; border-radius: 50%; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; font-size: 17px; box-shadow: 0 4px 10px rgba(0,0,0,0.35);">${iconHtml}</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -17],
      });
    };

    // Add Markers
    markers.forEach((m) => {
      if (typeof m.lat === 'number' && typeof m.lng === 'number' && !isNaN(m.lat) && !isNaN(m.lng)) {
        const marker = L.marker([m.lat, m.lng], {
          icon: createCustomIcon(m.type),
        });

        const popupContent = `
          <div style="font-family: Inter, system-ui, sans-serif; color: #0f172a; padding: 4px; min-width: 150px;">
            <strong style="font-size: 13px; color: #0f172a;">${m.label}</strong>
            ${m.details ? `<div style="font-size: 12px; margin-top: 4px; color: #475569; line-height: 1.4;">${m.details}</div>` : ''}
            <div style="font-size: 11px; color: #64748b; margin-top: 4px; border-top: 1px solid #e2e8f0; padding-top: 2px;">GPS: ${m.lat.toFixed(4)}, ${m.lng.toFixed(4)}</div>
          </div>
        `;
        marker.bindPopup(popupContent);
        marker.addTo(layerGroup);
        bounds.extend([m.lat, m.lng]);
      }
    });

    // Add Routes / Polylines
    routes.forEach((r) => {
      if (r.from && r.to && r.from.length === 2 && r.to.length === 2) {
        const polyline = L.polyline([r.from, r.to], {
          color: r.color || '#3b82f6',
          weight: 4,
          opacity: 0.85,
          dashArray: '8, 8',
        });
        polyline.addTo(layerGroup);
        bounds.extend(r.from);
        bounds.extend(r.to);
      }
    });

    // Auto-fit map view to bounds if markers/routes exist
    if (bounds.isValid()) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    } else if (center) {
      mapInstanceRef.current.setView(center, zoom);
    }
  }, [markers, routes, center, zoom]);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div
        ref={mapContainerRef}
        style={{
          height,
          width: '100%',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-card)',
        }}
      />

      {showLegend && (
        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            right: '10px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.4rem 0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.875rem',
            fontSize: '0.75rem',
            fontWeight: '600',
            color: 'var(--text-primary)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            zIndex: 400,
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>📍 Incident</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>🚑 Ambulance</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>🏥 Hospital</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--accent-blue)' }}>── Route</span>
        </div>
      )}
    </div>
  );
};
