import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle, Polygon, useMapEvents } from 'react-leaflet';
import L, { LatLng } from 'leaflet';
import 'leaflet/dist/leaflet.css';

export type GeoTrigger = {
  mode: 'circle' | 'polygon';
  center?: { lat: number; lng: number };
  radiusMeters?: number;              // circle mode
  polygon?: Array<{ lat: number; lng: number }>; // polygon mode
  address?: string;                   // optional, for editor convenience
};

// Fix default Leaflet marker icons when bundling
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

function ClickHandler({
  mode,
  onAddPoint,
  onSetCenter,
}: {
  mode: 'circle' | 'polygon';
  onAddPoint: (latlng: LatLng) => void;
  onSetCenter: (latlng: LatLng) => void;
}) {
  useMapEvents({
    click(e) {
      if (mode === 'polygon') onAddPoint(e.latlng);
      if (mode === 'circle') onSetCenter(e.latlng);
    },
  });
  return null;
}

export default function MapPicker({
  value,
  onChange,
  height = 360,
}: {
  value?: GeoTrigger;
  onChange: (next: GeoTrigger) => void;
  height?: number;
}) {
  const [mode, setMode] = useState<'circle' | 'polygon'>(value?.mode ?? 'circle');
  const [address, setAddress] = useState<string>(value?.address ?? '');
  const [center, setCenter] = useState<{ lat: number; lng: number }>(
    value?.center ?? { lat: 44.9778, lng: -93.265 } // Minneapolis default
  );
  const [radius, setRadius] = useState<number>(value?.radiusMeters ?? 100);
  const [poly, setPoly] = useState<Array<{ lat: number; lng: number }>>(value?.polygon ?? []);
  const mapRef = useRef<L.Map | null>(null);

  // Push value up anytime locals change
  useEffect(() => {
    onChange({
      mode,
      center: mode === 'circle' ? center : undefined,
      radiusMeters: mode === 'circle' ? radius : undefined,
      polygon: mode === 'polygon' ? poly : undefined,
      address: address || undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, address, center, radius, poly]);

  const addPolyPoint = (ll: LatLng) => setPoly((prev) => [...prev, { lat: ll.lat, lng: ll.lng }]);
  const clearPoly = () => setPoly([]);

  const flyTo = (lat: number, lng: number, zoom = 15) =>
    mapRef.current?.setView([lat, lng], zoom, { animate: true });

  const geocodeAddress = async () => {
    if (!address?.trim()) return;
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        address
      )}`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      const data = await res.json();
      if (Array.isArray(data) && data.length) {
        const { lat, lon } = data[0];
        const latNum = parseFloat(lat);
        const lonNum = parseFloat(lon);
        setCenter({ lat: latNum, lng: lonNum });
        flyTo(latNum, lonNum);
      }
    } catch (e) {
      console.error('Geocode failed', e);
    }
  };

  const bounds = useMemo(() => {
    if (mode === 'polygon' && poly.length) {
      return L.latLngBounds(poly.map((p) => [p.lat, p.lng]));
    }
    return undefined;
  }, [mode, poly]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm font-medium">Mode:</label>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as 'circle' | 'polygon')}
          className="border rounded px-2 py-1"
        >
          <option value="circle">Circle (pin + radius)</option>
          <option value="polygon">Polygon (click to add points)</option>
        </select>

        <div className="flex-1 min-w-[200px]" />

        <input
          type="text"
          placeholder="Search address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="border rounded px-2 py-1 w-[280px]"
        />
        <button type="button" onClick={geocodeAddress} className="border rounded px-3 py-1">
          Search
        </button>
      </div>

      {mode === 'circle' && (
        <div className="flex items-center gap-3">
          <span className="text-sm">Radius (meters):</span>
          <input
            type="number"
            min={10}
            step={10}
            value={radius}
            onChange={(e) => setRadius(Math.max(10, Number(e.target.value)))}
            className="border rounded px-2 py-1 w-28"
          />
        </div>
      )}

      {mode === 'polygon' && (
        <div className="flex items-center gap-2">
          <button type="button" className="border rounded px-3 py-1" onClick={clearPoly}>
            Clear polygon
          </button>
          <span className="text-xs text-neutral-600">Click map to add vertices.</span>
        </div>
      )}

      <MapContainer
        whenCreated={(m) => (mapRef.current = m)}
        center={[center.lat, center.lng]}
        zoom={13}
        style={{ width: '100%', height }}
        doubleClickZoom={false}
        className="rounded-lg overflow-hidden"
        bounds={bounds}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <ClickHandler
          mode={mode}
          onAddPoint={addPolyPoint}
          onSetCenter={(ll) => setCenter({ lat: ll.lat, lng: ll.lng })}
        />

        {mode === 'circle' && (
          <>
            <Marker
              draggable
              position={[center.lat, center.lng]}
              eventHandlers={{
                dragend: (e) => {
                  const ll = e.target.getLatLng();
                  setCenter({ lat: ll.lat, lng: ll.lng });
                },
              }}
            />
            <Circle center={[center.lat, center.lng]} radius={radius} />
          </>
        )}

        {mode === 'polygon' && poly.length > 0 && (
          <Polygon positions={poly.map((p) => [p.lat, p.lng]) as any} />
        )}
      </MapContainer>

      <div className="text-xs text-neutral-600">
        Saving:{" "}
        <code>
          {JSON.stringify({ mode, address, center, radiusMeters: radius, polygon: poly })}
        </code>
      </div>
    </div>
  );
}
