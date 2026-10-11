/**
 * Add Station – 5-step flow
 * Step 1: Location (GPS pin)
 * Step 2: Photos (compressed, EXIF-stripped)
 * Step 3: Name & landmark
 * Step 4: Destinations & fares
 * Step 5: Review & send
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { distanceMetres, isValidFare, compressImage, uuid, pickName, formatDistance } from '../lib/utils';
import { TextField, TextArea, Spinner, useToast } from '../components/ui/index';
import { useAuth } from '../hooks/useAuth';
import { RoutePathPickerModal, type RouteConfirmationData } from '../components/RoutePathPickerModal';
import type { AddStationDraft, DraftLine, Station } from '../types';

const DRAFT_KEY = 'tt-add-draft';
const TOTAL_STEPS = 5;

const emptyDraft = (): AddStationDraft => ({
  step: 1,
  lat: null, lng: null,
  submitter_lat: null, submitter_lng: null,
  gps_accuracy: null,
  photo_paths: [],
  name_am: '', name_en: '',
  landmark_am: '', landmark_en: '',
  lines: [],
});

function saveDraft(d: AddStationDraft) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
}
function loadDraft(): AddStationDraft | null {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null'); } catch { return null; }
}
function clearDraft() { localStorage.removeItem(DRAFT_KEY); }

/* Draggable station pin for crowdsourcing */
const dragPin = L.divIcon({
  html: `<div style="position:relative;width:40px;height:52px;display:flex;align-items:center;justify-content:center;">
    <svg width="40" height="52" viewBox="0 0 40 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 0C8.954 0 0 8.954 0 20C0 34.5 20 52 20 52C20 52 40 34.5 40 20C40 8.954 31.046 0 20 0Z" fill="#087E8B" stroke="#FFFFFF" stroke-width="2.5"/>
      <circle cx="20" cy="20" r="10" fill="#102A43"/>
      <circle cx="20" cy="20" r="5" fill="#D9F56D"/>
    </svg>
  </div>`,
  className: '',
  iconSize: [40, 52],
  iconAnchor: [20, 52],
});

/* ── Step progress bar ────────────────────────────────── */
function StepProgress({ step }: { step: number }) {
  const stepLabels = ['Location', 'Photos', 'Details', 'Fares', 'Review'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '8px 0 12px' }}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const isDone = i < step - 1;
        const isActive = i === step - 1;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1, gap: 6 }}>
            <div
              style={{
                height: 4,
                flex: 1,
                borderRadius: 2,
                background: isDone
                  ? 'var(--color-primary)'
                  : isActive
                  ? 'var(--color-accent)'
                  : 'var(--color-border)',
                transition: 'background 0.2s ease',
              }}
              title={stepLabels[i]}
            />
          </div>
        );
      })}
    </div>
  );
}

/* ── Step 1: Location ─────────────────────────────────── */
interface DraggableMarkerProps {
  pos: [number, number];
  onChange: (pos: [number, number]) => void;
}
function DraggableMarker({ pos, onChange }: DraggableMarkerProps) {
  const markerRef = useRef<L.Marker>(null);
  useMapEvents({
    click(e) { onChange([e.latlng.lat, e.latlng.lng]); },
  });
  return (
    <Marker
      position={pos}
      icon={dragPin}
      draggable
      ref={markerRef}
      eventHandlers={{
        dragend() {
          const m = markerRef.current;
          if (m) { const p = m.getLatLng(); onChange([p.lat, p.lng]); }
        },
      }}
    />
  );
}

const nearbyPinIcon = L.divIcon({
  html: `<div style="background:#102A43;color:#D9F56D;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;border:2px solid #FFFFFF;box-shadow:0 2px 6px rgba(16,42,67,0.3);">•</div>`,
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

interface Step1Props {
  draft: AddStationDraft;
  onUpdate: (d: Partial<AddStationDraft>) => void;
  onNext: () => void;
  nearbyStations: Station[];
}
function Step1Location({ draft, onUpdate, onNext, nearbyStations }: Step1Props) {
  const { t } = useTranslation();
  const [gettingGps, setGettingGps] = useState(false);
  const [accuracy, setAccuracy] = useState<number | null>(draft.gps_accuracy);
  const [locError, setLocError] = useState('');
  const [duplicate, setDuplicate] = useState<Station | null>(null);
  const [duplicateDist, setDuplicateDist] = useState(0);
  const [duplicateChoice, setDuplicateChoice] = useState<'same' | 'diff' | null>(null);
  const [isMapExpanded, setIsMapExpanded] = useState(false);

  // On mount get GPS
  useEffect(() => {
    if (draft.lat && draft.lng) return; // already have location from draft
    getGps();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getGps() {
    setGettingGps(true); setLocError('');
    navigator.geolocation.getCurrentPosition(
      pos => {
        setGettingGps(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = Math.round(pos.coords.accuracy);
        setAccuracy(acc);
        onUpdate({ lat, lng, submitter_lat: lat, submitter_lng: lng, gps_accuracy: acc });
        checkDuplicate(lat, lng);
      },
      () => {
        setGettingGps(false);
        // Fallback to central Addis so map & pin are immediately available on desktop
        const fallbackLat = 9.032;
        const fallbackLng = 38.746;
        onUpdate({
          lat: fallbackLat,
          lng: fallbackLng,
          submitter_lat: fallbackLat,
          submitter_lng: fallbackLng,
          gps_accuracy: null,
        });
        checkDuplicate(fallbackLat, fallbackLng);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  }

  function checkDuplicate(lat: number, lng: number) {
    const dup = nearbyStations.find(s => distanceMetres(lat, lng, s.lat, s.lng) < 30);
    if (dup) {
      setDuplicate(dup);
      setDuplicateDist(Math.round(distanceMetres(lat, lng, dup.lat, dup.lng)));
    }
  }

  const mapCenter: [number, number] = draft.lat && draft.lng
    ? [draft.lat, draft.lng]
    : [9.03, 38.74];

  const canContinue = !!draft.lat && !!draft.lng && (duplicateChoice !== null || !duplicate);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Hint */}
      <div style={{
        background: 'rgba(31,79,163,0.08)',
        border: '1px solid rgba(31,79,163,0.15)',
        borderRadius: 'var(--radius-sm)',
        padding: '10px 14px',
        fontSize: '0.875rem',
        display: 'flex', gap: 8, alignItems: 'flex-start',
      }}>
        <span style={{ flexShrink: 0 }}>📍</span>
        <span>{t('addStationFlow.locationHint')}</span>
      </div>

      {/* GPS accuracy badge */}
      {accuracy !== null && (
        <div>
          <span className={`accuracy-badge ${accuracy <= 50 ? 'good' : 'poor'}`}>
            {accuracy <= 50 ? '✓' : '⚠️'}{' '}
            {accuracy <= 50
              ? t('addStationFlow.accuracyGood', { metres: accuracy })
              : t('addStationFlow.accuracyPoor')}
          </span>
        </div>
      )}

      {/* GPS loading */}
      {gettingGps && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Spinner />
          <span className="text-sm text-muted">Getting GPS…</span>
        </div>
      )}

      {/* Location error */}
      {locError && (
        <div style={{ color: 'var(--clr-danger)', fontSize: '0.875rem', padding: '8px 12px', background: '#FDDAD9', borderRadius: 'var(--radius-sm)' }}>
          {locError}
          <button
            className="btn btn-secondary"
            style={{ marginTop: 8, width: '100%' }}
            onClick={getGps}
          >
            Retry GPS
          </button>
        </div>
      )}

      {/* Quick Jump Neighborhood Pills for easy placement */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', margin: '2px 0 6px 0' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--clr-ink-muted)' }}>📍 Quick Jump:</span>
        {[
          { name: 'Megenagna', coords: [9.0195, 38.8015] },
          { name: 'Mexico', coords: [9.0104, 38.7445] },
          { name: 'Bole', coords: [8.9952, 38.7885] },
          { name: 'Piassa', coords: [9.0345, 38.7525] },
          { name: 'Arat Kilo', coords: [9.0332, 38.7632] },
        ].map(hub => (
          <button
            key={hub.name}
            type="button"
            className="btn btn-ghost"
            style={{
              padding: '3px 8px', fontSize: '0.74rem', minHeight: 24, borderRadius: 100,
              background: 'var(--clr-surface)', border: '1px solid var(--clr-border)',
              color: 'var(--clr-ink)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
            onClick={() => {
              const [lat, lng] = hub.coords;
              onUpdate({ lat, lng, submitter_lat: lat, submitter_lng: lng });
              checkDuplicate(lat, lng);
            }}
          >
            {hub.name}
          </button>
        ))}
      </div>

      {/* Map */}
      {draft.lat && draft.lng && (
        <div className={`location-map-wrap ${isMapExpanded ? 'expanded' : ''}`}>
          <MapContainer
            center={mapCenter}
            zoom={17}
            style={{ width: '100%', height: '100%' }}
            zoomControl={true}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <DraggableMarker
              pos={[draft.lat, draft.lng]}
              onChange={([lat, lng]) => {
                onUpdate({ lat, lng });
                checkDuplicate(lat, lng);
              }}
            />
            {nearbyStations.map(s => (
              <Marker key={s.id} position={[s.lat, s.lng]} icon={nearbyPinIcon}>
                <Popup>{pickName(s.name_am, s.name_en, 'am') || 'Existing Station'}</Popup>
              </Marker>
            ))}
          </MapContainer>

          <button
            type="button"
            onClick={() => setIsMapExpanded(prev => !prev)}
            className="btn btn-secondary"
            style={{
              position: 'absolute', top: 10, right: 10, zIndex: 500,
              padding: '4px 10px', fontSize: '0.8rem', minHeight: 32,
              background: 'var(--clr-surface)', boxShadow: 'var(--shadow-card)',
            }}
          >
            {isMapExpanded ? '⤡ Compact' : '⤢ Expand Map'}
          </button>

          <div style={{
            position: 'absolute', bottom: 8, left: 8, zIndex: 500,
            background: 'var(--clr-surface)', borderRadius: 'var(--radius-sm)',
            padding: '4px 10px', fontSize: '0.78rem', color: 'var(--clr-ink-muted)',
            boxShadow: 'var(--shadow-card)',
          }}>
            Drag pin to station entrance · Gray pins are existing stations
          </div>
        </div>
      )}

      {/* Duplicate warning */}
      {duplicate && duplicateChoice === null && (
        <div className="duplicate-warn">
          <p className="duplicate-warn-text">
            ⚠️ {t('addStationFlow.duplicateWarning', {
              name: pickName(duplicate.name_am, duplicate.name_en, 'en'),
              dist: duplicateDist,
            })}
          </p>
          <div className="duplicate-warn-actions">
            <button className="btn btn-secondary" style={{ fontSize: '0.875rem', flex: 1 }}
              onClick={() => setDuplicateChoice('same')}>
              {t('addStationFlow.duplicateSame')}
            </button>
            <button className="btn btn-secondary" style={{ fontSize: '0.875rem', flex: 1 }}
              onClick={() => setDuplicateChoice('diff')}>
              {t('addStationFlow.duplicateDiff')}
            </button>
          </div>
        </div>
      )}

      <button
        className="btn btn-primary btn-full"
        disabled={!canContinue}
        onClick={onNext}
      >
        Continue →
      </button>
    </div>
  );
}

/* ── Step 2: Photos ───────────────────────────────────── */
interface PhotoPreview { localUrl: string; path: string | null; progress: number; error: string; }

interface Step2Props {
  draft: AddStationDraft;
  onUpdate: (d: Partial<AddStationDraft>) => void;
  onNext: () => void;
  userId: string;
}
function Step2Photos({ draft, onUpdate, onNext, userId }: Step2Props) {
  const { t } = useTranslation();
  const [previews, setPreviews] = useState<PhotoPreview[]>(
    draft.photo_paths.map(p => ({ localUrl: '', path: p, progress: 100, error: '' })),
  );
  const fileRef = useRef<HTMLInputElement>(null);

  async function addPhotos(files: FileList) {
    const newPreviews: PhotoPreview[] = Array.from(files).map(f => ({
      localUrl: URL.createObjectURL(f),
      path: null, progress: 0, error: '',
    }));
    const startIdx = previews.length;
    setPreviews(prev => [...prev, ...newPreviews]);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const blob = await compressImage(file);
        const ext = 'webp';
        const path = `${userId}/${uuid()}.${ext}`;

        // Simulate progress ticks
        for (let pct = 10; pct < 90; pct += 20) {
          await new Promise(r => setTimeout(r, 80));
          setPreviews(prev =>
            prev.map((p, idx) => idx === startIdx + i ? { ...p, progress: pct } : p),
          );
        }

        const { error } = await supabase.storage
          .from('station-photos')
          .upload(path, blob, { contentType: 'image/webp', upsert: false });

        if (error) throw error;

        setPreviews(prev =>
          prev.map((p, idx) => idx === startIdx + i ? { ...p, path, progress: 100 } : p),
        );
      } catch (err: unknown) {
        console.error('Photo upload error:', err);
        const msg = err && typeof err === 'object' && 'message' in err
          ? (err as { message: string }).message
          : 'Upload failed. Retry?';
        setPreviews(prev =>
          prev.map((p, idx) => idx === startIdx + i ? { ...p, progress: 0, error: msg.includes('Bucket not found') ? 'Storage bucket missing. Run SQL in Supabase' : 'Upload failed. Tap ✕ to remove' } : p),
        );
      }
    }
  }

  function removePhoto(idx: number) {
    const updated = previews.filter((_, i) => i !== idx);
    setPreviews(updated);
    onUpdate({ photo_paths: updated.map(p => p.path).filter(Boolean) as string[] });
  }

  // Sync paths on change
  useEffect(() => {
    onUpdate({ photo_paths: previews.map(p => p.path).filter(Boolean) as string[] });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previews]);

  const canContinue = previews.some(p => p.path);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Tip */}
      <div className="photo-tip">
        <span className="photo-tip-icon">💡</span>
        <span>{t('addStationFlow.photoHint')}</span>
      </div>

      {/* Photo grid */}
      <div className="photo-grid">
        {previews.map((p, i) => (
          <div key={i} className="photo-thumb">
            {p.localUrl
              ? <img src={p.localUrl} alt={`Photo ${i + 1}`} />
              : <div style={{ height: '100%', background: 'var(--clr-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>📷</div>
            }
            {p.progress < 100 && (
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
                <div style={{ height: 3, background: 'var(--clr-primary)', width: `${p.progress}%`, transition: 'width 0.2s' }} />
              </div>
            )}
            {p.error && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(179,38,30,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: '#fff', padding: 4, textAlign: 'center' }}>
                {p.error}
              </div>
            )}
            <button
              className="photo-thumb-remove"
              onClick={() => removePhoto(i)}
              aria-label="Remove photo"
            >✕</button>
          </div>
        ))}

        {previews.length < 3 && (
          <label className="photo-add-btn" htmlFor="photo-input" tabIndex={0}>
            <span className="photo-add-btn-icon">📷</span>
            <span>Add photo</span>
          </label>
        )}
      </div>

      <input
        id="photo-input"
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/webp,image/*"
        capture="environment"
        multiple
        className="visually-hidden"
        onChange={e => e.target.files && e.target.files.length > 0 && addPhotos(e.target.files)}
      />

      {!canContinue && (
        <p className="text-sm text-danger">{t('addStationFlow.photoRequired')}</p>
      )}

      <button
        className="btn btn-primary btn-full"
        disabled={!canContinue}
        onClick={onNext}
      >
        Continue →
      </button>
    </div>
  );
}

/* ── Step 3: Name & Landmark ──────────────────────────── */
interface Step3Props {
  draft: AddStationDraft;
  onUpdate: (d: Partial<AddStationDraft>) => void;
  onNext: () => void;
}
function Step3Name({ draft, onUpdate, onNext }: Step3Props) {
  const { t } = useTranslation();
  const [touched, setTouched] = useState(false);

  const nameError = touched && !draft.name_am && !draft.name_en
    ? t('addStationFlow.nameRequired')
    : '';

  const handleNext = () => {
    setTouched(true);
    if (!draft.name_am && !draft.name_en) return;
    onNext();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <TextField
        label={t('addStationFlow.nameAmLabel')}
        value={draft.name_am}
        onChange={e => onUpdate({ name_am: e.target.value })}
        maxLength={60}
        placeholder="ለምሳሌ፦ መስቀል አደባባይ ተራ"
        error={nameError && !draft.name_am && !draft.name_en ? nameError : ''}
        autoComplete="off"
        inputMode="text"
      />
      <TextField
        label={t('addStationFlow.nameEnLabel')}
        value={draft.name_en}
        onChange={e => onUpdate({ name_en: e.target.value })}
        maxLength={60}
        placeholder="e.g. Meskel Square Tera"
        autoComplete="off"
      />

      <div style={{ borderTop: '1px solid var(--clr-border)', paddingTop: 16 }}>
        <TextArea
          label={t('addStationFlow.landmarkAmLabel')}
          value={draft.landmark_am}
          onChange={e => onUpdate({ landmark_am: e.target.value })}
          maxLength={200}
          placeholder="ለምሳሌ፦ ከፋርማሲ ፊት፣ ዶ/ር ጥቁር አምባ ሆስፒታል ጎን"
          rows={2}
        />
      </div>
      <TextArea
        label={t('addStationFlow.landmarkEnLabel')}
        value={draft.landmark_en}
        onChange={e => onUpdate({ landmark_en: e.target.value })}
        maxLength={200}
        placeholder="e.g. In front of pharmacy, next to Black Lion Hospital"
        hint={t('addStationFlow.landmarkHint')}
        rows={2}
      />

      <button className="btn btn-primary btn-full" onClick={handleNext}>
        Continue →
      </button>
    </div>
  );
}

/* ── Step 4: Destinations & Fares ─────────────────────── */
interface Step4Props {
  draft: AddStationDraft;
  onUpdate: (d: Partial<AddStationDraft>) => void;
  onNext: () => void;
  stations?: Station[];
}
function Step4Lines({ draft, onUpdate, onNext, stations }: Step4Props) {
  const { t, i18n } = useTranslation();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activePickerLine, setActivePickerLine] = useState<DraftLine | null>(null);

  const updateLine = (id: string, patch: Partial<DraftLine>) => {
    onUpdate({
      lines: draft.lines.map(l => l.id === id ? { ...l, ...patch } : l),
    });
  };

  const addLine = () => {
    if (draft.lines.length >= 15) return;
    onUpdate({
      lines: [...draft.lines, {
        id: uuid(), destination_am: '', destination_en: '',
        fare_birr: '', direction: '', return_station_id: null,
      }],
    });
  };

  const removeLine = (id: string) => {
    onUpdate({ lines: draft.lines.filter(l => l.id !== id) });
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    draft.lines.forEach(l => {
      if (!isValidFare(l.fare_birr)) errs[l.id] = t('addStationFlow.fareInvalid');
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (!validate()) return;
    onNext();
  };

  const handleOpenPicker = (line: DraftLine) => {
    setActivePickerLine(line);
  };

  const handleConfirmRoutePicker = (data: RouteConfirmationData) => {
    if (!activePickerLine) return;
    updateLine(activePickerLine.id, {
      selected_route_id: data.selectedRouteId,
      route_geometry: data.routeGeometry,
      route_distance_meters: data.distanceMeters,
      route_duration_seconds: data.durationSeconds,
      via_corridor: data.viaCorridor,
      intermediate_stops: data.intermediateStops,
    });
    setActivePickerLine(null);
  };

  // Resolved coordinates for modal
  const startCoords: [number, number] =
    draft.lat && draft.lng ? [draft.lat, draft.lng] : [9.0215, 38.8020];
  const startName = pickName(draft.name_am, draft.name_en, i18n.language) || 'Start Hub';

  let endCoords: [number, number] = [9.0110, 38.7450];
  let endName = 'Destination';

  if (activePickerLine) {
    endName = pickName(activePickerLine.destination_am, activePickerLine.destination_en, i18n.language) || 'Destination';
    if (activePickerLine.end_coords) {
      endCoords = activePickerLine.end_coords;
    } else if (activePickerLine.end_station_id) {
      const match = stations?.find(s => s.id === activePickerLine.end_station_id);
      if (match) endCoords = [match.lat, match.lng];
    } else if (stations && stations.length > 0) {
      const q = (activePickerLine.destination_en || activePickerLine.destination_am || '').toLowerCase();
      const match = q ? stations.find(s =>
        s.name_en?.toLowerCase().includes(q) || s.name_am?.toLowerCase().includes(q)
      ) : null;
      if (match) {
        endCoords = [match.lat, match.lng];
      } else {
        endCoords = [startCoords[0] - 0.015, startCoords[1] - 0.02];
      }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Hint */}
      <div className="photo-tip">
        <span className="photo-tip-icon">💡</span>
        <span>{t('addStationFlow.fareHint')}</span>
      </div>

      {draft.lines.length === 0 && (
        <p className="text-sm text-muted" style={{ textAlign: 'center', padding: '12px 0' }}>
          No destinations added yet. Tap "Add destination" below.
        </p>
      )}

      {draft.lines.map((line, i) => (
        <div key={line.id} className="line-card">
          <div className="line-card-header">
            <span className="line-card-num">Destination {i + 1}</span>
            <button
              className="btn btn-ghost"
              style={{ minHeight: 32, padding: '0 8px', fontSize: '0.82rem', color: 'var(--clr-danger)' }}
              onClick={() => removeLine(line.id)}
            >
              {t('addStationFlow.removeLine')}
            </button>
          </div>

          <div className="line-two-col">
            <TextField
              label={t('addStationFlow.destinationAm')}
              value={line.destination_am}
              onChange={e => updateLine(line.id, { destination_am: e.target.value })}
              placeholder="ለምሳሌ፦ ቦሌ"
              inputMode="text"
            />
            <TextField
              label={t('addStationFlow.destinationEn')}
              value={line.destination_en}
              onChange={e => updateLine(line.id, { destination_en: e.target.value })}
              placeholder="e.g. Bole"
            />
          </div>

          <TextField
            label={t('addStationFlow.fare')}
            type="number"
            inputMode="numeric"
            min="1"
            max="500"
            value={line.fare_birr}
            onChange={e => updateLine(line.id, { fare_birr: e.target.value })}
            placeholder="e.g. 5"
            error={errors[line.id]}
          />

          <TextField
            label="Direction (optional)"
            value={line.direction}
            onChange={e => updateLine(line.id, { direction: e.target.value })}
            placeholder={t('addStationFlow.directionPlaceholder')}
          />

          {/* Optional Terminus / End Station picker */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--clr-ink)' }}>
              Terminus / Drop-off Station (optional)
            </label>
            <select
              value={line.end_station_id || ''}
              onChange={e => updateLine(line.id, { end_station_id: e.target.value || null })}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 10,
                border: '1px solid var(--clr-border)',
                background: 'var(--clr-surface)',
                color: 'var(--clr-ink)',
                fontSize: '0.88rem',
              }}
            >
              <option value="">Auto-predict from destination name</option>
              {stations?.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name_am} ({s.name_en})
                </option>
              ))}
            </select>
          </div>

          {/* Optional Corridor / Via Streets */}
          <TextField
            label="Corridor / Streets Passed Via (optional)"
            value={line.via_corridor || ''}
            onChange={e => updateLine(line.id, { via_corridor: e.target.value })}
            placeholder="e.g. በ 22 ማዞሪያ እና አትላስ በኩል (Via 22 / Atlas)"
          />

          {/* Real-Road Route Path & Waypoint Stops Selector */}
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--clr-ink)' }}>
                🗺️ Real-Road Route Path & Stops
              </span>
              {line.route_geometry && (
                <span style={{ fontSize: '0.74rem', color: '#10B981', fontWeight: 700 }}>
                  ✓ Path Saved ({formatDistance(line.route_distance_meters || 0)})
                </span>
              )}
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-full"
              style={{
                fontSize: '0.84rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                background: line.route_geometry ? 'rgba(110, 86, 207, 0.08)' : undefined,
                borderColor: line.route_geometry ? '#6E56CF' : undefined,
                color: line.route_geometry ? '#6E56CF' : undefined,
              }}
              onClick={() => handleOpenPicker(line)}
            >
              <span>{line.route_geometry ? '✏️ Edit Road Path & Stops' : '🗺️ Choose Real-Road Path on Map'}</span>
            </button>

            {line.intermediate_stops && line.intermediate_stops.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                {line.intermediate_stops.map((s, idx) => (
                  <span
                    key={s.id}
                    style={{
                      fontSize: '0.72rem',
                      background: 'var(--clr-surface)',
                      border: '1px solid var(--clr-border)',
                      padding: '2px 8px',
                      borderRadius: 100,
                      color: 'var(--clr-ink)',
                    }}
                  >
                    📍 {idx + 1}. {s.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

      {draft.lines.length < 15 && (
        <button
          className="btn btn-secondary btn-full"
          onClick={addLine}
          style={{ borderStyle: 'dashed' }}
        >
          + {t('addStationFlow.addLine')}
        </button>
      )}

      {/* Modal for Route Path and Stop Selection */}
      {activePickerLine && (
        <RoutePathPickerModal
          isOpen={true}
          onClose={() => setActivePickerLine(null)}
          startCoords={startCoords}
          startName={startName}
          endCoords={endCoords}
          endName={endName}
          existingStops={activePickerLine.intermediate_stops || []}
          initialRouteId={activePickerLine.selected_route_id}
          onConfirm={handleConfirmRoutePicker}
          stations={stations}
        />
      )}

      <button className="btn btn-primary btn-full" onClick={handleNext} style={{ marginTop: 4 }}>
        Continue →
      </button>
    </div>
  );
}

/* ── Step 5: Review & Send ────────────────────────────── */
interface Step5Props {
  draft: AddStationDraft;
  userId: string;
  onEdit: (step: number) => void;
  onSuccess: () => void;
}
function Step5Review({ draft, userId, onEdit, onSuccess }: Step5Props) {
  const { t } = useTranslation();
  const { show } = useToast();
  const [sending, setSending] = useState(false);

  const send = async () => {
    setSending(true);
    try {
      const { error } = await supabase.from('submissions').insert({
        type: 'new_station',
        payload: {
          name_am: draft.name_am, name_en: draft.name_en,
          landmark_am: draft.landmark_am, landmark_en: draft.landmark_en,
          lat: draft.lat, lng: draft.lng,
          lines: draft.lines.map(l => ({
            destination_am: l.destination_am, destination_en: l.destination_en,
            fare_birr: parseInt(l.fare_birr, 10),
            direction: l.direction,
            return_station_id: l.return_station_id,
            start_station_id: l.start_station_id,
            end_station_id: l.end_station_id,
            start_coords: l.start_coords,
            end_coords: l.end_coords,
            via_corridor: l.via_corridor,
            selected_route_id: l.selected_route_id,
            route_geometry: l.route_geometry,
            route_distance_meters: l.route_distance_meters,
            route_duration_seconds: l.route_duration_seconds,
            intermediate_stops: l.intermediate_stops,
          })),
        },
        photo_paths: draft.photo_paths,
        submitter_id: userId,
        submitter_lat: draft.submitter_lat,
        submitter_lng: draft.submitter_lng,
        status: 'pending',
      });
      if (error) throw error;
      clearDraft();
      onSuccess();
    } catch {
      show(t('errors.networkError'), 'danger');
      // Queue offline if needed
      if (!navigator.onLine) show(t('addStationFlow.savingOffline'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Location */}
      <div className="review-section">
        <div className="review-section-header">
          <span className="review-section-title">📍 {t('addStationFlow.step1')}</span>
          <button className="review-edit-btn" onClick={() => onEdit(1)}>Edit</button>
        </div>
        <div className="review-body">
          <p className="text-sm">
            {draft.lat?.toFixed(6)}, {draft.lng?.toFixed(6)}
          </p>
        </div>
      </div>

      {/* Photos */}
      <div className="review-section">
        <div className="review-section-header">
          <span className="review-section-title">📷 {t('addStationFlow.step2')}</span>
          <button className="review-edit-btn" onClick={() => onEdit(2)}>Edit</button>
        </div>
        <div className="review-body">
          <p className="text-sm">{draft.photo_paths.length} photo{draft.photo_paths.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Name */}
      <div className="review-section">
        <div className="review-section-header">
          <span className="review-section-title">🏷️ {t('addStationFlow.step3')}</span>
          <button className="review-edit-btn" onClick={() => onEdit(3)}>Edit</button>
        </div>
        <div className="review-body">
          {draft.name_am && (
            <div className="review-field">
              <div className="review-field-label">አማርኛ</div>
              <div className="review-field-value">{draft.name_am}</div>
            </div>
          )}
          {draft.name_en && (
            <div className="review-field">
              <div className="review-field-label">English</div>
              <div className="review-field-value">{draft.name_en}</div>
            </div>
          )}
          {(draft.landmark_am || draft.landmark_en) && (
            <div className="review-field">
              <div className="review-field-label">Landmark</div>
              <div className="review-field-value">{draft.landmark_am || draft.landmark_en}</div>
            </div>
          )}
        </div>
      </div>

      {/* Destinations */}
      <div className="review-section">
        <div className="review-section-header">
          <span className="review-section-title">🚌 {t('addStationFlow.step4')}</span>
          <button className="review-edit-btn" onClick={() => onEdit(4)}>Edit</button>
        </div>
        <div className="review-body">
          {draft.lines.length === 0
            ? <p className="text-sm text-muted">No destinations added.</p>
            : draft.lines.map((l) => (
              <div key={l.id} className="review-field" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div className="review-field-value" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700 }}>{l.destination_am || l.destination_en}</span>
                  <span className="font-bold" style={{ color: 'var(--clr-primary)' }}>
                    {l.fare_birr} birr
                  </span>
                </div>
                {l.route_distance_meters && (
                  <div style={{ fontSize: '0.74rem', color: '#10B981', fontWeight: 600 }}>
                    ✓ Road path: {formatDistance(l.route_distance_meters)}
                    {l.via_corridor ? ` · ${l.via_corridor}` : ''}
                  </div>
                )}
                {l.intermediate_stops && l.intermediate_stops.length > 0 && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--clr-ink-muted)' }}>
                    Stops: {l.intermediate_stops.map(s => s.name).join(' ➔ ')}
                  </div>
                )}
              </div>
            ))
          }
        </div>
      </div>

      <button
        className="btn btn-primary btn-full"
        onClick={send}
        disabled={sending}
        style={{ marginTop: 4 }}
      >
        {sending ? 'Sending…' : t('addStationFlow.sendReview')}
      </button>
    </div>
  );
}

/* ── Success screen ───────────────────────────────────── */
function SuccessScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="success-screen">
      <div className="success-icon">✓</div>
      <h1 style={{ fontSize: '1.4rem' }}>{t('addStationFlow.successTitle')}</h1>
      <p style={{ color: 'var(--clr-ink-muted)', maxWidth: 280 }}>
        {t('addStationFlow.successBody')}
      </p>
      <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => navigate('/')}>
        {t('addStationFlow.backToMap')}
      </button>
      <button className="btn btn-ghost" onClick={() => navigate('/me')}>
        {t('addStationFlow.myContributions')}
      </button>
    </div>
  );
}

/* ── Draft resume prompt ──────────────────────────────── */
function DraftResume({ onContinue, onFresh }: { onContinue: () => void; onFresh: () => void }) {
  const { t } = useTranslation();
  return (
    <div style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center' }}>
      <div style={{ fontSize: '2.5rem' }}>📝</div>
      <h2>{t('addStationFlow.continuePrompt')}</h2>
      <button className="btn btn-primary btn-full" onClick={onContinue}>{t('addStationFlow.continueDraft')}</button>
      <button className="btn btn-secondary btn-full" onClick={onFresh}>{t('addStationFlow.startFresh')}</button>
    </div>
  );
}

/* ── Step labels ──────────────────────────────────────── */
const STEP_KEYS: Record<number, string> = {
  1: 'addStationFlow.step1',
  2: 'addStationFlow.step2',
  3: 'addStationFlow.step3',
  4: 'addStationFlow.step4',
  5: 'addStationFlow.step5',
};

/* ── Main AddPage ─────────────────────────────────────── */
export default function AddPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const { show } = useToast();
  const [draft, setDraft] = useState<AddStationDraft>(emptyDraft());
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [showResume, setShowResume] = useState(false);
  const [nearbyStations, setNearbyStations] = useState<Station[]>([]);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      sessionStorage.setItem('tt-redirect-after-login', '/add');
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  // Blocked user
  useEffect(() => {
    if (!authLoading && profile?.blocked) {
      show(t('errors.blocked'), 'danger');
      navigate('/');
    }
  }, [profile, authLoading, navigate, show, t]);

  // Check for existing draft
  useEffect(() => {
    const saved = loadDraft();
    if (saved && saved.step > 1) setShowResume(true);
    else if (saved) setDraft(saved);
  }, []);

  // Load nearby stations for duplicate detection
  useEffect(() => {
    supabase.from('stations').select('*')
      .in('status', ['active', 'closed'])
      .then(({ data }) => setNearbyStations((data as Station[]) ?? []));
  }, []);

  const updateDraft = useCallback((patch: Partial<AddStationDraft>) => {
    setDraft(prev => {
      const next = { ...prev, ...patch };
      saveDraft(next);
      return next;
    });
  }, []);

  const goNext = () => {
    const next = step + 1;
    setStep(next);
    updateDraft({ step: next });
  };

  const goBack = () => {
    if (step === 1) { navigate(-1); return; }
    setStep(s => s - 1);
  };

  if (authLoading) return <div className="flex-center" style={{ height: '100%' }}><Spinner /></div>;
  if (!user) return null;

  if (done) return <SuccessScreen />;

  if (showResume) {
    return (
      <DraftResume
        onContinue={() => {
          const saved = loadDraft()!;
          setDraft(saved);
          setStep(saved.step);
          setShowResume(false);
        }}
        onFresh={() => {
          clearDraft();
          setDraft(emptyDraft());
          setShowResume(false);
        }}
      />
    );
  }

  return (
    <div className="add-flow-wrap">
      {/* Header */}
      <div className="add-flow-header">
        <button className="add-flow-back" onClick={goBack} aria-label="Back">
          ← {step === 1 ? 'Map' : 'Back'}
        </button>
        <StepProgress step={step} />
        <p className="add-flow-title">
          Step {step} of {TOTAL_STEPS} · {t(STEP_KEYS[step])}
        </p>
      </div>

      {/* Body */}
      <div className="add-flow-body">
        {step === 1 && (
          <Step1Location
            draft={draft}
            onUpdate={updateDraft}
            onNext={goNext}
            nearbyStations={nearbyStations}
          />
        )}
        {step === 2 && (
          <Step2Photos
            draft={draft}
            onUpdate={updateDraft}
            onNext={goNext}
            userId={user.id}
          />
        )}
        {step === 3 && (
          <Step3Name
            draft={draft}
            onUpdate={updateDraft}
            onNext={goNext}
          />
        )}
        {step === 4 && (
          <Step4Lines
            draft={draft}
            onUpdate={updateDraft}
            onNext={goNext}
            stations={nearbyStations}
          />
        )}
        {step === 5 && (
          <Step5Review
            draft={draft}
            userId={user.id}
            onEdit={s => setStep(s)}
            onSuccess={() => setDone(true)}
          />
        )}
      </div>
    </div>
  );
}
