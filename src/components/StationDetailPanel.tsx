import { useState } from 'react';
import {
  MapPin,
  Footprints,
  Route,
  ShieldCheck,
  AlertCircle,
  X,
  Navigation,
} from 'lucide-react';
import { pickName, distanceMetres, formatDistance, ADDIS_WALKING_SPEED_MPS } from '../lib/utils';
import type { Station, Line } from '../types';

interface StationDetailPanelProps {
  station: Station;
  lines: Line[];
  lang: string;
  userPos: [number, number] | null;
  onClose: () => void;
  onWalkMeThere: (station: Station) => void;
  onPlanFromStation: (station: Station) => void;
}

export function StationDetailPanel({
  station,
  lines,
  lang,
  userPos,
  onClose,
  onWalkMeThere,
  onPlanFromStation,
}: StationDetailPanelProps) {
  const name = pickName(station.name_am, station.name_en, lang);
  const altName = lang === 'am' ? station.name_en : station.name_am;
  const landmark = pickName(station.landmark_am, station.landmark_en, lang);

  const stationLines = lines.filter((l) => l.station_id === station.id);
  const [confirmedFares, setConfirmedFares] = useState<Record<string, boolean>>({});

  // Verification state (older than 90 days = outdated)
  const isOutdated = station.last_verified_at
    ? Date.now() - new Date(station.last_verified_at).getTime() > 90 * 24 * 60 * 60 * 1000
    : true;

  // Walking estimate from user position
  const walkDistanceMeters = userPos
    ? Math.round(distanceMetres(userPos[0], userPos[1], station.lat, station.lng))
    : null;
  const walkMinutes = walkDistanceMeters
    ? Math.max(1, Math.round(walkDistanceMeters / (ADDIS_WALKING_SPEED_MPS * 60)))
    : null;

  return (
    <div
      className="station-detail-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '20px',
        overflowY: 'auto',
        background: 'var(--color-surface)',
        position: 'relative',
      }}
    >
      {/* Top Header & Close Button */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ flex: 1, paddingRight: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                padding: '2px 8px',
                borderRadius: 4,
                background: 'rgba(8, 126, 139, 0.1)',
                color: 'var(--color-primary)',
              }}
            >
              TAXI TERA STATION
            </span>
            {station.status === 'closed' && (
              <span style={{ fontSize: '0.72rem', fontWeight: 700, background: '#FDECEC', color: '#C23B3B', padding: '2px 8px', borderRadius: 4 }}>
                CLOSED
              </span>
            )}
          </div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--color-brand)', margin: 0, lineHeight: 1.2 }}>
            {name}
          </h2>
          {altName && (
            <p style={{ fontSize: '0.88rem', color: 'var(--color-text-secondary)', margin: '3px 0 0' }}>
              {altName}
            </p>
          )}
        </div>

        <button
          onClick={onClose}
          className="btn btn-ghost"
          style={{ width: 34, height: 34, minHeight: 34, minWidth: 34, padding: 0, borderRadius: '50%' }}
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      {/* Boarding Landmark ("Stand here") */}
      {landmark && (
        <div
          style={{
            background: 'var(--color-surface-secondary)',
            borderRadius: 14,
            padding: '14px 16px',
            border: '1px solid var(--color-border)',
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: 'var(--color-primary)' }}>
            <MapPin size={15} />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)' }}>
              {lang === 'am' ? 'የት ይቁሙ' : 'Where to Stand / Board'}
            </span>
          </div>
          <p style={{ fontSize: '0.92rem', color: 'var(--color-text)', margin: 0, lineHeight: 1.5, fontWeight: 500 }}>
            {landmark}
          </p>
        </div>
      )}

      {/* Walking Distance Banner if user location is available */}
      {walkDistanceMeters && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            background: 'rgba(101, 84, 240, 0.08)',
            borderRadius: 12,
            border: '1px solid rgba(101, 84, 240, 0.18)',
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Footprints size={17} color="var(--color-primary)" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)' }}>
              {formatDistance(walkDistanceMeters)} away
            </span>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
            ~{walkMinutes} min walk
          </span>
        </div>
      )}

      {/* Primary Action Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
        <button
          onClick={() => onWalkMeThere(station)}
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            background: 'linear-gradient(135deg, #087E8B 0%, #16B5AD 100%)',
            color: '#FFFFFF',
            border: 'none',
            fontSize: '0.88rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            boxShadow: '0 3px 12px rgba(8, 126, 139, 0.25)',
            transition: 'all 0.15s ease',
          }}
        >
          <Navigation size={16} />
          <span>{lang === 'am' ? 'እግረኛ መንገድ' : 'Walk Here'}</span>
        </button>

        <button
          onClick={() => onPlanFromStation(station)}
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            background: 'linear-gradient(135deg, #6554F0 0%, #805CFF 100%)',
            color: '#FFFFFF',
            border: 'none',
            fontSize: '0.88rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            boxShadow: '0 3px 12px rgba(101, 84, 240, 0.25)',
            transition: 'all 0.15s ease',
          }}
        >
          <Route size={16} />
          <span>{lang === 'am' ? 'ከዚህ ጉዞ ጀምር' : 'Plan From Here'}</span>
        </button>
      </div>

      {/* Destinations & Fares Table */}
      <div style={{ borderRadius: 14, border: '1px solid var(--color-border)', overflow: 'hidden', marginBottom: 16 }}>
        <div
          style={{
            padding: '10px 14px',
            background: 'var(--color-surface-secondary)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)' }}>
            Destinations & Fares ({stationLines.length})
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--color-primary)', fontWeight: 600 }}>
            Official Addis Ababa Rate
          </span>
        </div>

        <div style={{ padding: '0 14px', background: 'var(--color-surface)' }}>
          {stationLines.length === 0 ? (
            <p style={{ padding: '16px 0', fontSize: '0.85rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
              No fare lines recorded yet.
            </p>
          ) : (
            stationLines.map((line) => (
              <div
                key={line.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 0',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--color-text)' }}>
                    {pickName(line.destination_am, line.destination_en, lang)}
                  </div>
                  {line.direction && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                      Via: {line.direction}
                    </div>
                  )}
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                    {line.fare_birr} birr
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 4 }}>
                    {confirmedFares[line.id] ? (
                      <span style={{ fontSize: '0.72rem', color: '#10B981', fontWeight: 700 }}>
                        ✓ {lang === 'am' ? 'ተረጋግጧል' : 'Confirmed'}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmedFares((prev) => ({ ...prev, [line.id]: true }))}
                        style={{
                          padding: '2px 8px',
                          borderRadius: 6,
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          background: 'rgba(8, 126, 139, 0.08)',
                          color: 'var(--color-primary)',
                          border: '1px solid rgba(8, 126, 139, 0.2)',
                          cursor: 'pointer',
                        }}
                        title={lang === 'am' ? 'ዋጋው አሁንም ትክክል መሆኑን ያረጋግጡ' : 'Confirm this fare is still current'}
                      >
                        👍 {lang === 'am' ? 'ትክክል ነው' : 'Still correct'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Verification & Trust Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.78rem',
          color: 'var(--color-text-muted)',
          paddingTop: 8,
          borderTop: '1px solid var(--color-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isOutdated ? (
            <AlertCircle size={15} color="#A15C07" />
          ) : (
            <ShieldCheck size={15} color="#18794E" />
          )}
          <span>
            {station.last_verified_at
              ? `Verified ${new Date(station.last_verified_at).toLocaleDateString()}`
              : 'Unverified'}
            {isOutdated && station.last_verified_at && ' (May be outdated)'}
          </span>
        </div>
      </div>
    </div>
  );
}
