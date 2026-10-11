import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTranslation } from 'react-i18next';
import { generateRouteChoices } from '../lib/routeChoiceService';
import { uuid, formatDistance } from '../lib/utils';
import type { IntermediateStop, RouteChoice, Station } from '../types';

/* ── Custom Pins for Start, End, and Intermediate Stops ──────── */
const startPin = L.divIcon({
  html: `<div style="background:#087E8B;color:#FFFFFF;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;border:3px solid #FFFFFF;box-shadow:0 4px 12px rgba(8,126,139,0.35);">A</div>`,
  className: '',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

const endPin = L.divIcon({
  html: `<div style="background:#14213D;color:#FFFFFF;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;border:3px solid #FFFFFF;box-shadow:0 4px 12px rgba(20,33,61,0.35);">B</div>`,
  className: '',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

const stopPin = L.divIcon({
  html: `<div style="background:#F2B705;color:#14213D;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;border:2.5px solid #14213D;box-shadow:0 2px 8px rgba(20,33,61,0.2);">•</div>`,
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

/* ── Map Click Listener for Adding Stops ────────────────────────── */
function MapClickHandler({ onMapClick, addingStop }: { onMapClick: (pos: [number, number]) => void; addingStop: boolean }) {
  useMapEvents({
    click(e) {
      if (addingStop) {
        onMapClick([e.latlng.lat, e.latlng.lng]);
      }
    },
  });
  return null;
}

/* ── Auto Bounds Adjuster ─────────────────────────────────────── */
function BoundsFitter({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length >= 2) {
      const bounds = L.latLngBounds(points.map(([lat, lng]) => [lat, lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }
  }, [points, map]);
  return null;
}

export interface RouteConfirmationData {
  selectedRouteId: string;
  routeGeometry: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
  viaCorridor: string;
  intermediateStops: IntermediateStop[];
}

interface RoutePathPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  startCoords: [number, number];
  startName?: string;
  endCoords: [number, number];
  endName?: string;
  existingStops?: IntermediateStop[];
  initialRouteId?: string;
  onConfirm: (data: RouteConfirmationData) => void;
  stations?: Station[];
}

export function RoutePathPickerModal({
  isOpen,
  onClose,
  startCoords,
  startName = 'Start Station',
  endCoords,
  endName = 'Destination',
  existingStops = [],
  initialRouteId,
  onConfirm,
}: RoutePathPickerModalProps) {
  const { i18n } = useTranslation();
  const lang = i18n.language;

  const [currentStart, setCurrentStart] = useState<[number, number]>(startCoords);
  const [currentEnd, setCurrentEnd] = useState<[number, number]>(endCoords);
  const [stops, setStops] = useState<IntermediateStop[]>(existingStops);
  const [choices, setChoices] = useState<RouteChoice[]>([]);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string>(initialRouteId || 'route_direct');
  const [loading, setLoading] = useState(false);
  const [isClickToAddMode, setIsClickToAddMode] = useState(false);
  const [newStopName, setNewStopName] = useState('');

  // Synchronize on modal open or coords change
  useEffect(() => {
    setCurrentStart(startCoords);
    setCurrentEnd(endCoords);
    setStops(existingStops);
  }, [startCoords, endCoords, existingStops, isOpen]);

  // Fetch / compute candidate route choices whenever start, end, or custom stops change
  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;

    async function compute() {
      setLoading(true);
      try {
        const results: RouteChoice[] = await generateRouteChoices(currentStart, currentEnd, stops);
        if (!isCancelled) {
          setChoices(results);
          // If stops were added, default to the custom route
          if (stops.length > 0 && results.some((r: RouteChoice) => r.id === 'route_custom')) {
            setSelectedChoiceId('route_custom');
          } else if (!results.some((r: RouteChoice) => r.id === selectedChoiceId)) {
            setSelectedChoiceId(results[0]?.id || 'route_direct');
          }
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    compute();
    return () => {
      isCancelled = true;
    };
  }, [currentStart, currentEnd, stops, isOpen]);

  if (!isOpen) return null;

  const selectedChoice = choices.find(c => c.id === selectedChoiceId) || choices[0];

  const handleAddStopAtCoords = (pos: [number, number]) => {
    const stopName = newStopName.trim() || `Stop ${stops.length + 1}`;
    const newStop: IntermediateStop = {
      id: uuid(),
      name: stopName,
      lat: pos[0],
      lng: pos[1],
    };
    setStops(prev => [...prev, newStop]);
    setNewStopName('');
    setIsClickToAddMode(false);
  };

  const handleRemoveStop = (id: string) => {
    setStops(prev => prev.filter(s => s.id !== id));
  };

  const handleUpdateStopName = (id: string, name: string) => {
    setStops(prev => prev.map(s => (s.id === id ? { ...s, name } : s)));
  };

  const handleConfirm = () => {
    if (!selectedChoice) return;
    const viaCorridorText =
      selectedChoice.viaStops.length > 0
        ? `Via ${selectedChoice.viaStops.map(s => s.name).join(', ')}`
        : selectedChoice.title_en;

    onConfirm({
      selectedRouteId: selectedChoice.id,
      routeGeometry: selectedChoice.coordinates,
      distanceMeters: selectedChoice.distanceMeters,
      durationSeconds: selectedChoice.durationSeconds,
      viaCorridor: viaCorridorText,
      intermediateStops: stops,
    });
    onClose();
  };

  // Map center calculation
  const centerLat = (currentStart[0] + currentEnd[0]) / 2;
  const centerLng = (currentStart[1] + currentEnd[1]) / 2;

  return (
    <div className="route-picker-overlay" onClick={onClose}>
      <div className="route-picker-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="route-picker-header">
          <div>
            <h3 className="route-picker-title">
              {lang === 'am' ? 'የታክሲ መስመር እና ማቆሚያዎችን ምረጥ' : 'Select Taxi Route Path & Stops'}
            </h3>
            <p className="route-picker-subtitle">
              {startName} ➔ {endName}
            </p>
          </div>
          <button type="button" className="route-picker-close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Map Container */}
        <div className="route-picker-map-wrap">
          <MapContainer
            center={[centerLat, centerLng]}
            zoom={13}
            scrollWheelZoom={true}
            style={{ width: '100%', height: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <BoundsFitter points={[currentStart, currentEnd, ...stops.map(s => [s.lat, s.lng] as [number, number])]} />
            <MapClickHandler onMapClick={handleAddStopAtCoords} addingStop={isClickToAddMode} />

            {/* Start Pin */}
            <Marker
              position={currentStart}
              icon={startPin}
              draggable={true}
              eventHandlers={{
                dragend: e => {
                  const p = e.target.getLatLng();
                  setCurrentStart([p.lat, p.lng]);
                },
              }}
            >
              <Popup>
                <strong>Start:</strong> {startName} <br />
                <small className="text-muted">Drag to adjust start pin</small>
              </Popup>
            </Marker>

            {/* End Pin */}
            <Marker
              position={currentEnd}
              icon={endPin}
              draggable={true}
              eventHandlers={{
                dragend: e => {
                  const p = e.target.getLatLng();
                  setCurrentEnd([p.lat, p.lng]);
                },
              }}
            >
              <Popup>
                <strong>Destination:</strong> {endName} <br />
                <small className="text-muted">Drag to adjust destination pin</small>
              </Popup>
            </Marker>

            {/* Intermediate Stop Pins */}
            {stops.map((stop, idx) => (
              <Marker
                key={stop.id}
                position={[stop.lat, stop.lng]}
                icon={stopPin}
                draggable={true}
                eventHandlers={{
                  dragend: e => {
                    const p = e.target.getLatLng();
                    setStops(prev =>
                      prev.map(s => (s.id === stop.id ? { ...s, lat: p.lat, lng: p.lng } : s))
                    );
                  },
                }}
              >
                <Popup>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <strong>Stop {idx + 1}:</strong> {stop.name}
                    <button
                      type="button"
                      style={{ color: '#EF4444', fontSize: '0.78rem', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
                      onClick={() => handleRemoveStop(stop.id)}
                    >
                      Remove Stop ✕
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Candidate Route Polylines */}
            {choices.map(c => {
              const isSelected = c.id === selectedChoiceId;
              return (
                <Polyline
                  key={c.id}
                  positions={c.coordinates}
                  pathOptions={{
                    color: isSelected ? '#6E56CF' : '#94A3B8',
                    weight: isSelected ? 6 : 4,
                    opacity: isSelected ? 0.95 : 0.45,
                    dashArray: isSelected ? undefined : '6, 8',
                  }}
                  eventHandlers={{
                    click: () => setSelectedChoiceId(c.id),
                  }}
                />
              );
            })}
          </MapContainer>

          {/* Map Overlay Badge */}
          <div className="route-picker-map-badge">
            {isClickToAddMode ? (
              <span style={{ color: '#F59E0B', fontWeight: 700 }}>
                👉 Tap anywhere on the map road to place stop
              </span>
            ) : (
              <span>💡 Tap a road or select a card below to switch paths</span>
            )}
          </div>
        </div>

        {/* Route Choice Cards */}
        <div className="route-picker-body">
          <div className="route-choice-section-title">
            <span>{lang === 'am' ? 'የመንገድ አማራጮች' : 'Available Route Paths'}</span>
            {loading && <span className="route-picker-spinner">Updating roads...</span>}
          </div>

          <div className="route-choice-grid">
            {choices.map(c => {
              const isSelected = c.id === selectedChoiceId;
              const mins = Math.max(1, Math.round(c.durationSeconds / 60));
              const distText = formatDistance(c.distanceMeters);

              return (
                <div
                  key={c.id}
                  className={`route-choice-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedChoiceId(c.id)}
                >
                  <div className="route-choice-top">
                    <span className="route-choice-name">
                      {lang === 'am' ? c.title_am : c.title_en}
                    </span>
                    {isSelected && <span className="route-choice-check">✓ Active</span>}
                  </div>
                  <div className="route-choice-metrics">
                    <span>📏 {distText}</span>
                    <span>⏱️ ~{mins} mins</span>
                  </div>
                  <div className="route-choice-desc">{c.corridorDescription}</div>
                </div>
              );
            })}
          </div>

          {/* Add / Manage Intermediate Stops */}
          <div className="route-stops-management">
            <div className="route-stops-header">
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--clr-ink)' }}>
                📍 {lang === 'am' ? 'የመሃል ማቆሚያዎች' : 'Intermediate Pickup Stops'} ({stops.length})
              </span>
              <button
                type="button"
                className={`route-add-stop-btn ${isClickToAddMode ? 'active' : ''}`}
                onClick={() => setIsClickToAddMode(!isClickToAddMode)}
              >
                {isClickToAddMode ? '✕ Cancel Pin Drop' : '➕ Tap Map to Add Stop'}
              </button>
            </div>

            {stops.length > 0 && (
              <div className="route-stops-list">
                {stops.map((stop, idx) => (
                  <div key={stop.id} className="route-stop-item">
                    <span className="route-stop-num">{idx + 1}</span>
                    <input
                      type="text"
                      className="route-stop-input"
                      value={stop.name}
                      onChange={e => handleUpdateStopName(stop.id, e.target.value)}
                      placeholder="Stop landmark (e.g. Urael)"
                    />
                    <button
                      type="button"
                      className="route-stop-del-btn"
                      onClick={() => handleRemoveStop(stop.id)}
                      title="Remove stop"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="route-picker-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {lang === 'am' ? 'ሰርዝ' : 'Cancel'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={{ minWidth: 160, fontWeight: 750 }}
            onClick={handleConfirm}
            disabled={!selectedChoice}
          >
            ✓ {lang === 'am' ? 'ይህንን መስመር አጽድቅ' : 'Confirm This Route'}
          </button>
        </div>
      </div>
    </div>
  );
}
