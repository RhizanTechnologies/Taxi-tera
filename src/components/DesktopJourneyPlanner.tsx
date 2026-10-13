import { useState, useEffect, useMemo, Fragment } from 'react';
import {
  Navigation,
  MapPin,
  ArrowUpDown,
  Search,
  Clock,
  Footprints,
  ChevronRight,
  Sparkles,
  AlertCircle,
  X,
  Crosshair,
} from 'lucide-react';
import { pickName, distanceMetres, matchesStationBilingualSearch } from '../lib/utils';
import { findTransitJourneys, hydrateJourneyWithRealRoads } from '../lib/transitRouter';
import type { Station, Line, TransitJourney } from '../types';

interface DesktopJourneyPlannerProps {
  userPos: [number, number] | null;
  stations: Station[];
  lines: Line[];
  lang: string;
  onSelectJourney: (journey: TransitJourney | null) => void;
  activeJourney: TransitJourney | null;
  initialDestinationStation?: Station | null;
  onClose?: () => void;
  onOpenLocationPicker?: () => void;
  onRequestGPS?: () => void;
  permissionChecking?: boolean;
}

export function DesktopJourneyPlanner({
  userPos,
  stations,
  lines,
  lang,
  onSelectJourney,
  activeJourney,
  initialDestinationStation,
  onClose,
  onOpenLocationPicker,
  onRequestGPS,
  permissionChecking = false,
}: DesktopJourneyPlannerProps) {
  // Origin and destination state
  const [originMode, setOriginMode] = useState<'current' | 'station'>('current');
  const [originStation, setOriginStation] = useState<Station | null>(null);
  const [destinationStation, setDestinationStation] = useState<Station | null>(initialDestinationStation || null);

  const [destSearch, setDestSearch] = useState(
    initialDestinationStation ? pickName(initialDestinationStation.name_am, initialDestinationStation.name_en, lang) : ''
  );
  const [originSearch, setOriginSearch] = useState('');
  const [isDestFocused, setIsDestFocused] = useState(false);
  const [isOriginFocused, setIsOriginFocused] = useState(false);

  const [journeys, setJourneys] = useState<TransitJourney[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Sync if initialDestinationStation changes
  useEffect(() => {
    if (initialDestinationStation) {
      setDestinationStation(initialDestinationStation);
      setDestSearch(pickName(initialDestinationStation.name_am, initialDestinationStation.name_en, lang));
    }
  }, [initialDestinationStation, lang]);

  // Destination autocomplete matches (bilingual: English & Amharic)
  const destMatches = useMemo(() => {
    if (!destSearch.trim() || destinationStation) return [];
    return stations
      .map((s) => {
        const res = matchesStationBilingualSearch(s, destSearch, lines);
        return res.matched ? { station: s, score: res.score } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b!.score - a!.score)
      .map((m) => m!.station)
      .slice(0, 6);
  }, [destSearch, destinationStation, stations, lines]);

  // Origin autocomplete matches (if picking station origin)
  const originMatches = useMemo(() => {
    if (!originSearch.trim() || originStation || originMode !== 'station') return [];
    return stations
      .map((s) => {
        const res = matchesStationBilingualSearch(s, originSearch, lines);
        return res.matched ? { station: s, score: res.score } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b!.score - a!.score)
      .map((m) => m!.station)
      .slice(0, 6);
  }, [originSearch, originStation, originMode, stations, lines]);

  // Swap Origin and Destination
  const handleSwap = () => {
    if (originMode === 'current') {
      // Find nearest station to userPos
      if (userPos && stations.length > 0) {
        const sorted = [...stations].sort((a, b) => {
          return distanceMetres(userPos[0], userPos[1], a.lat, a.lng) - distanceMetres(userPos[0], userPos[1], b.lat, b.lng);
        });
        const currentAsStation = sorted[0];
        setOriginMode('station');
        setOriginStation(destinationStation);
        setOriginSearch(destinationStation ? pickName(destinationStation.name_am, destinationStation.name_en, lang) : '');
        setDestinationStation(currentAsStation);
        setDestSearch(pickName(currentAsStation.name_am, currentAsStation.name_en, lang));
      }
    } else {
      const prevOrigin = originStation;
      const prevDest = destinationStation;
      setOriginStation(prevDest);
      setOriginSearch(prevDest ? pickName(prevDest.name_am, prevDest.name_en, lang) : '');
      setDestinationStation(prevOrigin);
      setDestSearch(prevOrigin ? pickName(prevOrigin.name_am, prevOrigin.name_en, lang) : '');
    }
  };

  // Perform Route Calculation
  const handleFindTaxi = async () => {
    if (!destinationStation) return;

    const originCoords: [number, number] =
      originMode === 'current'
        ? userPos || [9.0215, 38.8020] // Default fallback to central Addis if GPS not loaded
        : originStation
        ? [originStation.lat, originStation.lng]
        : userPos || [9.0215, 38.8020];

    setIsSearching(true);
    setHasSearched(true);

    try {
      const results = findTransitJourneys({
        originCoords,
        destinationStation,
        allStations: stations,
        allLines: lines,
        lang,
      });

      // Hydrate with real road corridors
      const hydrated = await Promise.all(results.slice(0, 4).map((j) => hydrateJourneyWithRealRoads(j)));
      setJourneys(hydrated);

      if (hydrated.length > 0) {
        onSelectJourney(hydrated[0]);
      } else {
        onSelectJourney(null);
      }
    } catch (err) {
      console.error('Journey planning error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // Auto-search if destination station was pre-set
  useEffect(() => {
    if (initialDestinationStation && !hasSearched) {
      handleFindTaxi();
    }
  }, [initialDestinationStation]);

  // Quick Popular Hubs
  const popularHubs = [
    { name_en: 'Megenagna', name_am: 'መገናኛ' },
    { name_en: 'Mexico', name_am: 'ሜክሲኮ' },
    { name_en: 'Piassa', name_am: 'ፒያሳ' },
    { name_en: 'Bole', name_am: 'ቦሌ' },
    { name_en: '4 Kilo', name_am: '4 ኪሎ' },
  ];

  return (
    <div
      className="desktop-journey-planner"
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
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2
            style={{
              fontSize: '1.25rem',
              fontWeight: 800,
              color: 'var(--color-brand)',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>{lang === 'am' ? 'ጉዞዎን ያቅዱ' : 'Plan Your Trip'}</span>
            <Sparkles size={18} color="#F2B705" />
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: '3px 0 0' }}>
            {lang === 'am' ? 'የአዲስ አበባ ታክሲ መስመሮች እና ዋጋ' : 'Verified Addis Ababa taxi corridors & fares'}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="btn btn-ghost"
            style={{ width: 32, height: 32, padding: 0, borderRadius: '50%' }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Origin & Destination Inputs Group */}
      <div
        style={{
          background: 'var(--color-surface-secondary)',
          borderRadius: 16,
          padding: '14px',
          border: '1px solid var(--color-border)',
          position: 'relative',
          marginBottom: 16,
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02)',
        }}
      >
        {/* Origin Field */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'rgba(8, 126, 139, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-primary)',
                flexShrink: 0,
              }}
            >
              <Navigation size={15} />
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
              {originMode === 'current' ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 10,
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    fontSize: '0.86rem',
                    fontWeight: 600,
                    color: 'var(--color-text)',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22A06B', flexShrink: 0 }} />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {lang === 'am' ? 'የአሁኑ መገኛዬ' : 'My Location'}
                      {userPos && stations.length > 0 && (() => {
                        let closest = stations[0];
                        let minDist = Infinity;
                        for (const s of stations) {
                          const d = distanceMetres(userPos[0], userPos[1], s.lat, s.lng);
                          if (d < minDist) { minDist = d; closest = s; }
                        }
                        const name = pickName(closest.name_am, closest.name_en, lang);
                        return (
                          <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', fontWeight: 500, marginLeft: 4 }}>
                            (~{name})
                          </span>
                        );
                      })()}
                    </span>
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {onRequestGPS && (
                      <button
                        type="button"
                        onClick={onRequestGPS}
                        disabled={permissionChecking}
                        style={{
                          background: 'rgba(8, 126, 139, 0.12)',
                          border: '1px solid rgba(8, 126, 139, 0.25)',
                          fontSize: '0.73rem',
                          color: 'var(--color-primary)',
                          cursor: 'pointer',
                          fontWeight: 700,
                          padding: '3px 7px',
                          borderRadius: 6,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                        title={lang === 'am' ? 'የአሁኑን መገኛ በጂፒኤስ ፈልግ' : 'Detect current GPS location'}
                      >
                        <Crosshair size={12} />
                        <span>
                          {permissionChecking
                            ? (lang === 'am' ? 'በመፈለግ...' : 'Locating...')
                            : (lang === 'am' ? 'ጂፒኤስ ፈልግ' : 'Detect GPS')}
                        </span>
                      </button>
                    )}
                    {onOpenLocationPicker && (
                      <button
                        type="button"
                        onClick={onOpenLocationPicker}
                        style={{
                          background: 'var(--color-surface-secondary)',
                          border: '1px solid var(--color-border)',
                          fontSize: '0.73rem',
                          color: 'var(--color-text)',
                          cursor: 'pointer',
                          fontWeight: 600,
                          padding: '3px 7px',
                          borderRadius: 6,
                        }}
                        title={lang === 'am' ? 'ሰፈር ምረጥ ወይም ካርታ ላይ ጠቁም' : 'Pick neighborhood or tap map'}
                      >
                        {lang === 'am' ? 'ቀይር' : 'Change'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setOriginMode('station');
                        setOriginStation(null);
                        setOriginSearch('');
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '0.73rem',
                        color: 'var(--color-text-muted)',
                        cursor: 'pointer',
                        fontWeight: 600,
                        textDecoration: 'underline',
                      }}
                    >
                      {lang === 'am' ? 'ተራ ምረጥ' : 'Station'}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    value={originStation ? pickName(originStation.name_am, originStation.name_en, lang) : originSearch}
                    onChange={(e) => {
                      setOriginStation(null);
                      setOriginSearch(e.target.value);
                    }}
                    onFocus={() => setIsOriginFocused(true)}
                    placeholder={lang === 'am' ? 'የመነሻ ጣቢያ ይምረጡ...' : 'Choose origin station...'}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 10,
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      fontSize: '0.88rem',
                      color: 'var(--color-text)',
                      outline: 'none',
                    }}
                  />
                  {originMatches.length > 0 && isOriginFocused && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        background: 'var(--color-surface)',
                        borderRadius: 10,
                        border: '1px solid var(--color-border)',
                        boxShadow: 'var(--shadow-floating)',
                        zIndex: 20,
                        marginTop: 4,
                      }}
                    >
                      {originMatches.map((st) => (
                        <div
                          key={st.id}
                          onClick={() => {
                            setOriginStation(st);
                            setOriginSearch(pickName(st.name_am, st.name_en, lang));
                            setIsOriginFocused(false);
                          }}
                          style={{ padding: '8px 12px', fontSize: '0.85rem', cursor: 'pointer', borderBottom: '1px solid var(--color-border)' }}
                        >
                          {pickName(st.name_am, st.name_en, lang)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Swap Button Divider */}
        <div style={{ position: 'relative', height: 1, background: 'var(--color-border)', margin: '10px 0' }}>
          <button
            type="button"
            onClick={handleSwap}
            title="Swap Origin and Destination"
            style={{
              position: 'absolute',
              right: 18,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
              zIndex: 5,
              transition: 'transform 0.2s ease',
            }}
          >
            <ArrowUpDown size={14} />
          </button>
        </div>

        {/* Destination Field */}
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'rgba(101, 84, 240, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-primary)',
                flexShrink: 0,
              }}
            >
              <MapPin size={15} />
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type="text"
                value={destSearch}
                onChange={(e) => {
                  setDestinationStation(null);
                  setDestSearch(e.target.value);
                }}
                onFocus={() => setIsDestFocused(true)}
                placeholder={lang === 'am' ? 'የት መሄድ ይፈልጋሉ? (ለምሳሌ መገናኛ)' : 'Where are you going? (e.g. Megenagna)'}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: 'var(--color-surface)',
                  border: destinationStation ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                  fontSize: '0.9rem',
                  fontWeight: destinationStation ? 600 : 400,
                  color: 'var(--color-text)',
                  outline: 'none',
                }}
              />
              {destinationStation && (
                <button
                  type="button"
                  onClick={() => {
                    setDestinationStation(null);
                    setDestSearch('');
                  }}
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
                  ✕
                </button>
              )}

              {/* Destination Autocomplete Dropdown */}
              {isDestFocused && destMatches.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    right: 0,
                    background: 'var(--color-surface)',
                    borderRadius: 12,
                    border: '1px solid var(--color-border)',
                    boxShadow: 'var(--shadow-floating)',
                    zIndex: 30,
                    overflow: 'hidden',
                  }}
                >
                  {destMatches.map((st) => (
                    <div
                      key={st.id}
                      onClick={() => {
                        setDestinationStation(st);
                        setDestSearch(pickName(st.name_am, st.name_en, lang));
                        setIsDestFocused(false);
                      }}
                      style={{
                        padding: '10px 14px',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--color-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--color-text)' }}>
                          {pickName(st.name_am, st.name_en, lang)}
                          {st.name_en && st.name_am && (
                            <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', fontSize: '0.78rem', marginLeft: 6 }}>
                              ({lang === 'am' ? st.name_en : st.name_am})
                            </span>
                          )}
                        </div>
                        {st.landmark_am && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                            📍 {pickName(st.landmark_am, st.landmark_en, lang)}
                          </div>
                        )}
                      </div>
                      <ChevronRight size={14} color="var(--color-text-muted)" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Destination Chips */}
      {!destinationStation && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {lang === 'am' ? 'ተወዳጅ መዳረሻዎች' : 'Popular Destinations'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {popularHubs.map((hub) => {
              const matchedSt = stations.find((s) =>
                (s.name_en || '').toLowerCase().includes(hub.name_en.toLowerCase()) ||
                (s.name_am || '').includes(hub.name_am)
              );
              return (
                <button
                  key={hub.name_en}
                  type="button"
                  onClick={() => {
                    if (matchedSt) {
                      setDestinationStation(matchedSt);
                      setDestSearch(pickName(matchedSt.name_am, matchedSt.name_en, lang));
                    } else {
                      setDestSearch(hub.name_en);
                    }
                  }}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 20,
                    background: 'var(--color-surface-secondary)',
                    border: '1px solid var(--color-border)',
                    fontSize: '0.78rem',
                    fontWeight: 500,
                    color: 'var(--color-text)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {lang === 'am' ? hub.name_am : hub.name_en}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Primary "Find My Taxi" Button */}
      <button
        onClick={handleFindTaxi}
        disabled={!destinationStation || isSearching}
        style={{
          width: '100%',
          padding: '13px 20px',
          borderRadius: 14,
          background: destinationStation
            ? 'var(--gradient-primary)'
            : 'var(--color-surface-secondary)',
          color: destinationStation ? '#FFFFFF' : 'var(--color-text-muted)',
          border: 'none',
          fontSize: '0.96rem',
          fontWeight: 750,
          cursor: destinationStation ? 'pointer' : 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          boxShadow: destinationStation ? '0 6px 20px rgba(79, 70, 229, 0.36)' : 'none',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          marginBottom: 20,
        }}
      >
        <Search size={18} />
        <span>{isSearching ? (lang === 'am' ? 'መስመሮች በመፈለግ ላይ...' : 'Searching Routes...') : (lang === 'am' ? 'ታክሲ ፈልግ' : 'Find My Taxi')}</span>
      </button>

      {/* Journey Results Section */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {hasSearched && journeys.length === 0 && !isSearching && (
          <div
            style={{
              padding: '24px 16px',
              textAlign: 'center',
              background: 'var(--color-surface-secondary)',
              borderRadius: 14,
              border: '1px solid var(--color-border)',
            }}
          >
            <AlertCircle size={24} color="var(--color-text-muted)" style={{ margin: '0 auto 8px' }} />
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text)' }}>
              {lang === 'am' ? 'ቀጥታ የታክሲ መስመር አልተገኘም' : 'No Direct Taxi Corridor Found'}
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
              {lang === 'am' ? 'ወደ ቅርብ ዋና ጣቢያ (ለምሳሌ መገናኛ ወይም ሜክሲኮ) በመሄድ መቀየር ይችላሉ' : 'Try searching from a central transport hub like Megenagna or Mexico.'}
            </p>
          </div>
        )}

        {journeys.map((j) => {
          const isSelected = activeJourney?.id === j.id;
          const isDirect = j.transfersCount === 0;

          return (
            <div
              key={j.id}
              onClick={() => onSelectJourney(j)}
              className="interactive-card"
              style={{
                borderRadius: 16,
                border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                background: isSelected ? 'var(--color-surface-highlight)' : 'var(--color-surface)',
                padding: '16px',
                cursor: 'pointer',
                boxShadow: isSelected ? '0 8px 24px -4px rgba(79, 70, 229, 0.24)' : '0 2px 8px rgba(15, 23, 42, 0.04)',
                transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              {/* Badge & Fare Row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 750,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    padding: '3px 9px',
                    borderRadius: 6,
                    background: isDirect ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                    color: isDirect ? '#10B981' : '#F59E0B',
                    border: `1px solid ${isDirect ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`,
                  }}
                >
                  {isDirect ? (lang === 'am' ? 'ቀጥታ ታክሲ' : 'DIRECT TAXI') : (lang === 'am' ? '1 ዝውውር' : '1 TRANSFER')}
                </span>

                <div
                  className="tabular-nums"
                  style={{
                    fontSize: '1.15rem',
                    fontWeight: 800,
                    color: 'var(--color-primary)',
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 3,
                  }}
                >
                  <span>{j.totalFareBirr}</span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>birr</span>
                </div>
              </div>

              {/* Title & Timing Row */}
              <div>
                <div style={{ fontSize: '0.96rem', fontWeight: 750, color: 'var(--color-text)', letterSpacing: '-0.01em' }}>
                  {pickName(j.summaryTitle_am, j.summaryTitle_en, lang)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 5, fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 550 }}>
                    <Clock size={14} color="var(--color-primary)" /> ~{j.totalDurationMinutes} min
                  </span>
                  {j.steps.some((s) => s.kind === 'walk_to_station') && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 550 }}>
                      <Footprints size={14} color="#10B981" /> Walk to station
                    </span>
                  )}
                </div>
              </div>

              {/* Step Summary Strip */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  paddingTop: 10,
                  borderTop: '1px solid var(--color-border)',
                  fontSize: '0.78rem',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {j.steps.map((st, i) => (
                  <Fragment key={i}>
                    {i > 0 && <span style={{ color: 'var(--color-text-muted)' }}>➔</span>}
                    <span
                      style={{
                        fontWeight: 650,
                        color: st.kind === 'ride_taxi' ? 'var(--color-brand)' : 'var(--color-text-secondary)',
                        background: st.kind === 'ride_taxi' ? 'var(--color-surface-secondary)' : 'transparent',
                        padding: st.kind === 'ride_taxi' ? '2px 6px' : '0',
                        borderRadius: 4,
                      }}
                    >
                      {st.kind === 'ride_taxi' ? 'Minibus' : 'Walk'}
                    </span>
                  </Fragment>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
