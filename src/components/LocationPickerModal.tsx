import { useState, useMemo } from 'react';
import { X, MapPin, Search, Crosshair, Navigation, Check } from 'lucide-react';
import { pickName, matchesStationBilingualSearch } from '../lib/utils';
import type { Station, Line } from '../types';

export interface AddisNeighborhood {
  id: string;
  name_am: string;
  name_en: string;
  coords: [number, number];
  icon?: string;
  subcity?: string;
}

export const ADDIS_NEIGHBORHOODS: AddisNeighborhood[] = [
  { id: 'bole_medhanialem', name_am: 'ቦሌ መድኃኔዓለም', name_en: 'Bole Medhanialem', coords: [8.9912, 38.7865], icon: '✈️', subcity: 'Bole' },
  { id: 'bole_atlas', name_am: 'ቦሌ አትላስ', name_en: 'Bole Atlas', coords: [9.0065, 38.7845], icon: '🏨', subcity: 'Bole' },
  { id: 'megenagna', name_am: 'መገናኛ', name_en: 'Megenagna', coords: [9.0215, 38.8020], icon: '🔄', subcity: 'Yeka' },
  { id: 'mexico', name_am: 'ሜክሲኮ', name_en: 'Mexico Square', coords: [9.0108, 38.7460], icon: '🏛️', subcity: 'Kirkos' },
  { id: 'piassa', name_am: 'ፒያሳ', name_en: 'Piassa / Arada', coords: [9.0345, 38.7523], icon: '🏰', subcity: 'Arada' },
  { id: 'arat_kilo', name_am: 'አራት ኪሎ', name_en: 'Arat Kilo', coords: [9.0335, 38.7629], icon: '🎓', subcity: 'Arada' },
  { id: 'kazanchis', name_am: 'ካዛንቺስ', name_en: 'Kazanchis', coords: [9.0182, 38.7705], icon: '🏢', subcity: 'Kirkos' },
  { id: 'cmc', name_am: 'ሲኤምሲ', name_en: 'CMC Michael', coords: [9.0195, 38.8450], icon: '🏘️', subcity: 'Yeka' },
  { id: 'ayat', name_am: 'አያት', name_en: 'Ayat', coords: [9.0260, 38.8780], icon: '🏡', subcity: 'Yeka' },
  { id: 'saris', name_am: 'ሳሪስ', name_en: 'Saris', coords: [8.9567, 38.7758], icon: '🏬', subcity: 'Akaki-Kality' },
  { id: 'kality', name_am: 'ቃሊቲ', name_en: 'Kality', coords: [8.9185, 38.7610], icon: '🏭', subcity: 'Akaki-Kality' },
  { id: 'tor_hailoch', name_am: 'ጦር ኃይሎች', name_en: 'Tor Hailoch', coords: [9.0135, 38.7245], icon: '🛡️', subcity: 'Lideta' },
  { id: 'sarbet', name_am: 'ሳርቤት', name_en: 'Sarbet', coords: [9.0012, 38.7360], icon: '🐎', subcity: 'Kirkos' },
  { id: 'merkato', name_am: 'መርካቶ / አውቶቡስ ተራ', name_en: 'Merkato / Autobus Tera', coords: [9.0375, 38.7380], icon: '🛍️', subcity: 'Addis Ketema' },
  { id: 'stadium', name_am: 'እስቴዲየም / ለገሃር', name_en: 'Stadium / Legehar', coords: [9.0152, 38.7528], icon: '🏟️', subcity: 'Kirkos' },
  { id: 'jemo', name_am: 'ጀሞ', name_en: 'Jemo 1', coords: [8.9650, 38.7075], icon: '🏘️', subcity: 'Nifas Silk-Lafto' },
  { id: 'lebu', name_am: 'ለቡ', name_en: 'Lebu', coords: [8.9720, 38.7310], icon: '🌲', subcity: 'Nifas Silk-Lafto' },
  { id: 'ayertena', name_am: 'አየር ጤና', name_en: 'Ayertena', coords: [9.0050, 38.7050], icon: '⛰️', subcity: 'Kolfe Keranio' },
  { id: 'gotera', name_am: 'ጎተራ', name_en: 'Gotera', coords: [8.9905, 38.7590], icon: '🌉', subcity: 'Kirkos' },
  { id: 'kotebe', name_am: 'ኮተቤ', name_en: 'Kotebe', coords: [9.0310, 38.8350], icon: '🎒', subcity: 'Yeka' },
  { id: 'shiromeda', name_am: 'ሽሮ ሜዳ', name_en: 'Shiromeda', coords: [9.0620, 38.7620], icon: '🏔️', subcity: 'Gullele' },
  { id: 'gerji', name_am: 'ገርጂ', name_en: 'Gerji / Roba', coords: [8.9880, 38.8150], icon: '🏢', subcity: 'Bole' },
  { id: 'summit', name_am: 'ሰሚት', name_en: 'Summit Condominium', coords: [9.0050, 38.8680], icon: '🏡', subcity: 'Bole' },
];

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: string;
  currentPos: [number, number] | null;
  stations: Station[];
  lines: Line[];
  onSelectCoords: (coords: [number, number], label?: string) => void;
  onStartMapPick: () => void;
  onRequestDeviceGPS?: () => void;
}

export function LocationPickerModal({
  isOpen,
  onClose,
  lang,
  currentPos,
  stations,
  lines,
  onSelectCoords,
  onStartMapPick,
  onRequestDeviceGPS,
}: LocationPickerModalProps) {
  const [search, setSearch] = useState('');

  // Station search results
  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.trim().toLowerCase();

    // Search neighborhoods first
    const nResults = ADDIS_NEIGHBORHOODS.filter(n => {
      const matchAm = n.name_am.includes(q);
      const matchEn = n.name_en.toLowerCase().includes(q);
      return matchAm || matchEn;
    }).map(n => ({
      id: `nh-${n.id}`,
      name: lang === 'am' ? n.name_am : n.name_en,
      sub: n.subcity ? `${n.subcity} · Neighborhood` : 'Neighborhood',
      coords: n.coords,
      isStation: false,
    }));

    // Search stations
    const stResults = stations
      .map(s => {
        const res = matchesStationBilingualSearch(s, search, lines);
        if (!res.matched) return null;
        return {
          id: s.id,
          name: pickName(s.name_am, s.name_en, lang),
          sub: pickName(s.landmark_am, s.landmark_en, lang) || 'Station / Tera',
          coords: [s.lat, s.lng] as [number, number],
          score: res.score,
          isStation: true,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    return [...nResults, ...stResults];
  }, [search, stations, lines, lang]);

  if (!isOpen) return null;

  const handleDeviceGPS = () => {
    // Crucial for mobile / Android: close the modal overlay first so Android does NOT
    // block the browser permission prompt with "This site can't ask for your permission. Close any bubbles or overlays".
    onClose();
    if (onRequestDeviceGPS) {
      setTimeout(() => {
        onRequestDeviceGPS();
      }, 100);
    }
  };

  return (
    <div
      className="location-picker-overlay"
      onClick={onClose}
    >
      <div
        className="location-picker-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px 14px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: 'rgba(8, 126, 139, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-primary)',
              }}
            >
              <MapPin size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
                {lang === 'am' ? 'ያለህበትን ቦታ አስተካክል' : 'Set Your Location'}
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                {lang === 'am'
                  ? 'ሰፈርህን ምረጥ ወይም ካርታው ላይ ጠቁም'
                  : 'Select your neighborhood or tap directly on the map'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: 6, borderRadius: '50%' }}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Action Bar (Map Pin Drop & GPS) */}
        <div style={{ padding: '14px 20px 10px', display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{ flex: 1, gap: 8, height: 42, fontSize: '0.85rem' }}
            onClick={() => {
              onStartMapPick();
              onClose();
            }}
          >
            <Navigation size={16} />
            {lang === 'am' ? 'ካርታ ላይ ጠቁም (Pick on Map)' : 'Pick Directly on Map'}
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            style={{ gap: 6, height: 42, fontSize: '0.82rem', padding: '0 14px' }}
            onClick={handleDeviceGPS}
          >
            <Crosshair size={15} color="var(--color-primary)" />
            <span>{lang === 'am' ? 'የመሣሪያ ጂፒኤስ' : 'Device GPS'}</span>
          </button>
        </div>

        {/* Search input */}
        <div style={{ padding: '0 20px 12px' }}>
          <div style={{ position: 'relative' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-text-muted)',
              }}
            />
            <input
              type="text"
              className="input"
              placeholder={lang === 'am' ? 'ሰፈር ወይም ተራ ፈልግ (ለምሳሌ ቦሌ፣ ሜክሲኮ፣ ሳሪስ...)' : 'Search neighborhood or tera (e.g. Bole, Mexico...)'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                paddingLeft: 36,
                height: 40,
                fontSize: '0.85rem',
                borderRadius: 10,
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-text-muted)',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable list of options */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>
          {search.trim().length > 0 ? (
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>
                {lang === 'am' ? 'የተገኙ ቦታዎች' : 'Matching Locations'} ({searchResults.length})
              </div>
              {searchResults.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                  {lang === 'am' ? 'ቦታ አልተገኘም። እባክዎ ካርታው ላይ በቀጥታ ይጠቁሙ!' : 'No match found. Use "Pick Directly on Map" above!'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {searchResults.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: 'var(--color-surface-secondary)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 10,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                      onClick={() => {
                        onSelectCoords(item.coords, item.name);
                        onClose();
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ color: 'var(--color-primary)' }}>
                          <MapPin size={16} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--color-text)' }}>
                            {item.name}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
                            {item.sub}
                          </div>
                        </div>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                        {lang === 'am' ? 'ቦታዬ አድርግ' : 'Set as Mine'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {lang === 'am' ? 'ዋና ዋና የአዲስ አበባ ሰፈሮች (ፈጣን ምርጫ)' : 'Popular Addis Ababa Hubs (1-Click)'}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: 8,
                }}
              >
                {ADDIS_NEIGHBORHOODS.map((nh) => {
                  const isCurrent = currentPos &&
                    Math.abs(currentPos[0] - nh.coords[0]) < 0.005 &&
                    Math.abs(currentPos[1] - nh.coords[1]) < 0.005;

                  return (
                    <button
                      key={nh.id}
                      type="button"
                      style={{
                        padding: '10px 12px',
                        borderRadius: 12,
                        border: isCurrent ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                        background: isCurrent ? 'rgba(8, 126, 139, 0.08)' : 'var(--color-surface)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'transform 0.12s ease, border-color 0.12s ease',
                      }}
                      onClick={() => {
                        onSelectCoords(nh.coords, lang === 'am' ? nh.name_am : nh.name_en);
                        onClose();
                      }}
                    >
                      <span style={{ fontSize: '1.1rem' }}>{nh.icon || '📍'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: isCurrent ? 800 : 600,
                            fontSize: '0.82rem',
                            color: 'var(--color-text)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {lang === 'am' ? nh.name_am : nh.name_en}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
                          {nh.subcity}
                        </div>
                      </div>
                      {isCurrent && <Check size={14} color="var(--color-primary)" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
