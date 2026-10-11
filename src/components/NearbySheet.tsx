import { useMemo } from 'react';
import { BottomSheet } from './ui/index';
import { distanceMetres, pickName, calculateWalkingMinutes, formatDistance, formatWalkingTime } from '../lib/utils';
import type { Station, Line } from '../types';

interface NearbySheetProps {
  open: boolean;
  onClose: () => void;
  userPos: [number, number] | null;
  onRequestLoc: () => void;
  stations: Station[];
  lines: Line[];
  lang: string;
  onSelectStation: (s: Station) => void;
  onWalkMeThere?: (s: Station) => void;
}

export function NearbySheet({
  open,
  onClose,
  userPos,
  onRequestLoc,
  stations,
  lines,
  lang,
  onSelectStation,
  onWalkMeThere,
}: NearbySheetProps) {

  // Reference origin: user GPS position or fallback to center Megenagna
  const origin: [number, number] = userPos || [9.0215, 38.8020];

  const sortedStations = useMemo(() => {
    return stations
      .filter(s => s.status === 'active')
      .map(s => {
        const dist = Math.round(distanceMetres(origin[0], origin[1], s.lat, s.lng));
        const walkMin = calculateWalkingMinutes(dist, true);
        const stationLines = lines.filter(l => l.station_id === s.id).slice(0, 3);
        return { station: s, dist, walkMin, lines: stationLines };
      })
      .sort((a, b) => a.dist - b.dist);
  }, [stations, lines, origin]);

  return (
    <BottomSheet open={open} onClose={onClose} className="station-card-sheet">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '1.2rem' }}>🚶</span>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
              {lang === 'am' ? 'አቅራቢያዎ ያሉ ታክሲ ተራዎች' : 'Stations Near You'}
            </h2>
          </div>
          <p className="text-xs text-muted" style={{ marginTop: 2 }}>
            {userPos
              ? (lang === 'am' ? 'በእርስዎ የቀጥታ ርቀት የተደረደሩ' : 'Sorted by walking distance from your GPS')
              : (lang === 'am' ? 'ከመገናኛ ማዕከል የተሰላ ርቀት' : 'Estimated from Megenagna center (tap GPS to locate)')}
          </p>
        </div>
        <button
          onClick={onClose}
          className="btn btn-ghost"
          style={{ width: 32, height: 32, minHeight: 32, minWidth: 32, padding: 0, borderRadius: '50%', background: 'var(--clr-soft)', fontSize: '0.85rem' }}
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {!userPos && (
        <div style={{
          padding: '10px 14px', background: 'rgba(59, 102, 245, 0.08)', borderRadius: 'var(--radius)',
          border: '1px solid rgba(59, 102, 245, 0.2)', marginBottom: 12,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--clr-primary)', fontWeight: 600 }}>
            📍 Enable GPS for live walking distance
          </div>
          <button
            type="button"
            className="btn btn-primary"
            style={{ fontSize: '0.75rem', padding: '4px 10px', minHeight: 26 }}
            onClick={onRequestLoc}
          >
            Locate Me
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '60vh', overflowY: 'auto', paddingRight: 2 }}>
        {sortedStations.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--clr-ink-muted)' }}>
            No stations found nearby.
          </div>
        ) : (
          sortedStations.map(({ station, dist, walkMin, lines: stLines }) => (
            <div
              key={station.id}
              onClick={() => {
                onClose();
                onSelectStation(station);
              }}
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius)',
                background: 'var(--clr-surface)',
                border: '1px solid var(--clr-border)',
                boxShadow: 'var(--shadow-card)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                transition: 'transform 0.15s ease, border-color 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.98rem', color: 'var(--clr-ink)' }}>
                    {pickName(station.name_am, station.name_en, lang)}
                  </div>
                  {station.name_am && station.name_en && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--clr-ink-muted)' }}>
                      {lang === 'am' ? station.name_en : station.name_am}
                    </div>
                  )}
                </div>
                <div style={{
                  padding: '3px 8px', borderRadius: 100,
                  background: dist < 500 ? 'rgba(16, 185, 129, 0.15)' : 'var(--clr-soft)',
                  color: dist < 500 ? '#10B981' : 'var(--clr-ink-muted)',
                  fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap',
                }}>
                  {formatDistance(dist)} · ~{formatWalkingTime(walkMin, lang)}
                </div>
              </div>

              {(station.landmark_am || station.landmark_en) && (
                <div style={{ fontSize: '0.8rem', color: 'var(--clr-ink-muted)', display: 'flex', gap: 4 }}>
                  <span>📍</span>
                  <span>{pickName(station.landmark_am, station.landmark_en, lang)}</span>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: 1 }}>
                  {stLines.map(l => (
                    <span
                      key={l.id}
                      style={{
                        padding: '2px 8px', borderRadius: 6, background: 'var(--clr-soft)',
                        fontSize: '0.74rem', color: 'var(--clr-ink)', fontWeight: 500,
                      }}
                    >
                      {pickName(l.destination_am, l.destination_en, lang)}{' '}
                      <strong style={{ color: 'var(--clr-primary)' }}>{l.fare_birr} Br</strong>
                    </span>
                  ))}
                  {lines.filter(l => l.station_id === station.id).length > 3 && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--clr-ink-muted)', alignSelf: 'center' }}>
                      +{lines.filter(l => l.station_id === station.id).length - 3} more
                    </span>
                  )}
                </div>

                {onWalkMeThere && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{
                      padding: '4px 10px', minHeight: 28, fontSize: '0.75rem',
                      borderRadius: 100, flexShrink: 0, fontWeight: 700,
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose();
                      onWalkMeThere(station);
                    }}
                    title="Walk me there"
                  >
                    <span>🚶</span>
                    <span>{lang === 'am' ? 'እግረኛ' : 'Walk'}</span>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </BottomSheet>
  );
}
