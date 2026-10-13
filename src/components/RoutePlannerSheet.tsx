import { useState, useMemo, useEffect } from 'react';
import type { Station, Line, TransitJourney } from '../types';
import { findTransitJourneys } from '../lib/transitRouter';
import { pickName, matchesStationBilingualSearch } from '../lib/utils';

interface RoutePlannerSheetProps {
  open: boolean;
  onClose: () => void;
  userPos: [number, number] | null;
  stations: Station[];
  lines: Line[];
  lang: string;
  onSelectJourney: (journey: TransitJourney | null) => void;
  activeJourney: TransitJourney | null;
  onPickOriginOnMap?: () => void;
  initialDestinationStation?: Station | null;
}

export function RoutePlannerSheet({
  open,
  onClose,
  userPos,
  stations,
  lines,
  lang,
  onSelectJourney,
  activeJourney,
  onPickOriginOnMap,
  initialDestinationStation,
}: RoutePlannerSheetProps) {
  // Destination selection state
  const [destSearch, setDestSearch] = useState('');
  const [selectedDestStation, setSelectedDestStation] = useState<Station | null>(initialDestinationStation || null);

  // Origin coordinates: default to userPos or Addis central fallback (e.g. road between Megenagna and Bole)
  const [customOrigin, setCustomOrigin] = useState<[number, number] | null>(null);
  const [originLabel, setOriginLabel] = useState<string>('');

  useEffect(() => {
    if (initialDestinationStation) {
      setSelectedDestStation(initialDestinationStation);
      setDestSearch(pickName(initialDestinationStation.name_am, initialDestinationStation.name_en, lang));
    }
  }, [initialDestinationStation, lang]);

  const effectiveOrigin: [number, number] = useMemo(() => {
    if (customOrigin) return customOrigin;
    if (userPos) return userPos;
    // Default fallback: between Megenagna and Bole (Cape Verde / 22 road)
    return [9.0185, 38.7845];
  }, [customOrigin, userPos]);

  // Filtered station suggestions for destination input (bilingual: English & Amharic)
  const destinationSuggestions = useMemo(() => {
    if (!destSearch.trim()) {
      // Suggest top major hubs by default
      const hubs = ['shiromeda', 'arat kilo', 'mexico', 'megenagna', 'bole', 'piassa', 'sidist kilo', 'merkato', 'jemo', 'kality'];
      return stations
        .filter(s => hubs.some(h => (s.name_en || '').toLowerCase().includes(h) || (s.name_am || '').includes(h)))
        .slice(0, 8);
    }
    return stations
      .map((s) => {
        const res = matchesStationBilingualSearch(s, destSearch, lines);
        return res.matched ? { station: s, score: res.score } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b!.score - a!.score)
      .map((m) => m!.station)
      .slice(0, 8);
  }, [destSearch, stations, lines]);

  // Compute transit journeys whenever origin or destination changes
  const computedJourneys = useMemo(() => {
    if (!selectedDestStation) return [];
    return findTransitJourneys({
      originCoords: effectiveOrigin,
      destinationStation: selectedDestStation,
      allStations: stations,
      allLines: lines,
      lang,
    });
  }, [effectiveOrigin, selectedDestStation, stations, lines, lang]);

  // When activeJourney is cleared from outside (e.g. user clicked ✕ on top bar), reset internal destination
  useEffect(() => {
    if (!activeJourney) {
      setSelectedDestStation(null);
      setDestSearch('');
    }
  }, [activeJourney]);

  const handleSelectDest = (st: Station) => {
    setSelectedDestStation(st);
    setDestSearch(pickName(st.name_am, st.name_en, lang));
    const journeys = findTransitJourneys({
      originCoords: effectiveOrigin,
      destinationStation: st,
      allStations: stations,
      allLines: lines,
      lang,
    });
    if (journeys.length > 0) {
      onSelectJourney(journeys[0]);
    } else {
      onSelectJourney(null);
    }
  };

  const handleSwap = () => {
    if (selectedDestStation) {
      const prevDest = selectedDestStation;
      const prevDestName = pickName(prevDest.name_am, prevDest.name_en, lang);

      // Check if current effectiveOrigin matches any station
      const prevOriginStation = stations.find(s =>
        Math.abs(s.lat - effectiveOrigin[0]) < 0.003 && Math.abs(s.lng - effectiveOrigin[1]) < 0.003
      );

      setCustomOrigin([prevDest.lat, prevDest.lng]);
      setOriginLabel(prevDestName);

      if (prevOriginStation) {
        setSelectedDestStation(prevOriginStation);
        setDestSearch(pickName(prevOriginStation.name_am, prevOriginStation.name_en, lang));
      } else {
        setSelectedDestStation(null);
        setDestSearch('');
        onSelectJourney(null);
      }
    }
  };

  if (!open) return null;

  return (
    <div
      className="route-planner-sheet-backdrop"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 890,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
    >
      <div
        className="route-planner-sheet-card"
        style={{
          pointerEvents: 'auto',
          background: 'var(--clr-surface)',
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          border: '1.5px solid var(--clr-border)',
          boxShadow: '0 -10px 40px rgba(15, 23, 42, 0.22)',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          maxWidth: 540,
          margin: '0 auto',
          width: '100%',
        }}
      >
        {/* Grab handle & Title header */}
        <div style={{ padding: '12px 18px 8px 18px', borderBottom: '1px solid var(--clr-border)', position: 'relative' }}>
          <div
            style={{
              width: 38,
              height: 4,
              borderRadius: 2,
              background: 'var(--clr-border)',
              margin: '0 auto 10px auto',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.25rem' }}>🔀</span>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--clr-ink)' }}>
                {lang === 'am' ? 'የታክሲ መስመር እና ጉዞ አቅጅ' : 'Transit Route & Journey Planner'}
              </h2>
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              style={{
                width: 32,
                height: 32,
                minWidth: 32,
                minHeight: 32,
                padding: 0,
                borderRadius: '50%',
                color: 'var(--clr-ink-muted)',
              }}
              onClick={() => {
                onClose();
                onSelectJourney(null);
              }}
              aria-label="Close route planner"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Origin & Destination inputs */}
        <div style={{ padding: '14px 18px', background: 'var(--clr-soft)', borderBottom: '1px solid var(--clr-border)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Origin Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 22 }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#0E7490', border: '2px solid #FFFFFF' }} />
                <span style={{ width: 2, height: 26, background: 'var(--clr-border)' }} />
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--clr-surface)', border: '1px solid var(--clr-border)', borderRadius: 12, padding: '7px 12px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--clr-ink-muted)' }}>📍</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--clr-ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {originLabel || (userPos ? (lang === 'am' ? 'ያለህበት ቦታ (Current Location)' : 'My Current Location') : (lang === 'am' ? 'በመገናኛ እና ቦሌ መሃል (Cape Verde St)' : 'Between Megenagna & Bole (Cape Verde St)'))}
                </span>
                {userPos && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 100, color: '#0E7490', background: 'rgba(14, 116, 144, 0.1)' }}
                    onClick={() => {
                      setCustomOrigin(null);
                      setOriginLabel('');
                    }}
                  >
                    GPS
                  </button>
                )}
                {onPickOriginOnMap && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 100, color: 'var(--clr-ink-muted)' }}
                    onClick={onPickOriginOnMap}
                    title="Click any street on map as origin"
                  >
                    🗺️
                  </button>
                )}
              </div>
            </div>

            {/* Origin <-> Destination Swap Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: 6, margin: '-6px 0 -6px 0' }}>
              <button
                type="button"
                className="btn btn-ghost"
                style={{
                  width: 28, height: 28, minWidth: 28, minHeight: 28, padding: 0,
                  borderRadius: '50%', background: 'var(--clr-surface)', border: '1px solid var(--clr-border)',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.06)', fontSize: '0.85rem', color: 'var(--clr-primary)',
                }}
                onClick={handleSwap}
                title={lang === 'am' ? 'የመነሻ እና መድረሻ ቦታዎችን ቀይር' : 'Swap Origin and Destination'}
              >
                ⇅
              </button>
            </div>

            {/* Destination Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22 }}>
                <span style={{ width: 12, height: 12, borderRadius: 2, background: '#EA580C', border: '2px solid #FFFFFF' }} />
              </div>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  type="text"
                  placeholder={lang === 'am' ? 'ወዴት መሄድ ትፈልጋለህ? (ለምሳሌ፡ ሽሮሜዳ፣ 4 ኪሎ...)' : 'Where do you want to go? (e.g. Shiromeda, 4 Kilo...)'}
                  value={destSearch}
                  onChange={(e) => {
                    setDestSearch(e.target.value);
                    if (selectedDestStation) setSelectedDestStation(null);
                  }}
                  style={{
                    width: '100%',
                    background: 'var(--clr-surface)',
                    border: '1.5px solid var(--clr-primary)',
                    borderRadius: 12,
                    padding: '8px 12px',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    color: 'var(--clr-ink)',
                    outline: 'none',
                    boxShadow: '0 2px 8px rgba(110, 86, 207, 0.12)',
                  }}
                />
                {destSearch && (
                  <button
                    type="button"
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--clr-ink-muted)',
                      fontSize: '0.85rem',
                    }}
                    onClick={() => {
                      setDestSearch('');
                      setSelectedDestStation(null);
                      onSelectJourney(null);
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick destination chips suggestions if not picked yet */}
          {!selectedDestStation && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--clr-ink-muted)', alignSelf: 'center', marginRight: 4 }}>
                {lang === 'am' ? 'ፈጣን መዳረሻዎች፡' : 'Popular destinations:'}
              </span>
              {destinationSuggestions.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => handleSelectDest(st)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 100,
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    background: 'var(--clr-surface)',
                    border: '1px solid var(--clr-border)',
                    color: 'var(--clr-ink)',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                  }}
                >
                  📍 {pickName(st.name_am, st.name_en, lang)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Results area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {selectedDestStation && computedJourneys.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--clr-ink-muted)' }}>
              <p style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 6px 0' }}>
                {lang === 'am' ? 'የታክሲ መስመር አልተገኘም' : 'No direct or 1-transfer taxi found'}
              </p>
              <p style={{ fontSize: '0.82rem', margin: 0 }}>
                {lang === 'am'
                  ? 'እባክህ የተለየ መነሻ ወይም መዳረሻ ምረጥ'
                  : 'Try selecting a nearby transit hub or different starting street.'}
              </p>
            </div>
          )}

          {computedJourneys.map((journey) => {
            const isSelected = activeJourney?.id === journey.id;
            const badgeLabel = journey.label === 'direct'
              ? (lang === 'am' ? '✨ ቀጥታ መስመር (0 ቅያሪ)' : '✨ Direct Line (0 Transfers)')
              : journey.label === 'fastest'
              ? (lang === 'am' ? '⚡ ፈጣን ጉዞ' : '⚡ Fastest Route')
              : journey.label === 'least_walking'
              ? (lang === 'am' ? '🚶 አነስተኛ እርምጃ' : '🚶 Least Walking')
              : (lang === 'am' ? '💵 ቆጣቢ ዋጋ' : '💵 Cheapest Fare');

            return (
              <div
                key={journey.id}
                onClick={() => onSelectJourney(journey)}
                style={{
                  borderRadius: 18,
                  padding: '14px',
                  background: isSelected ? 'var(--clr-surface)' : 'var(--clr-soft)',
                  border: isSelected ? '2px solid var(--clr-primary)' : '1px solid var(--clr-border)',
                  boxShadow: isSelected ? '0 8px 24px rgba(110, 86, 207, 0.16)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                }}
              >
                {/* Header: Label, Duration, Fare */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        padding: '3px 8px',
                        borderRadius: 100,
                        background: journey.label === 'direct' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(110, 86, 207, 0.12)',
                        color: journey.label === 'direct' ? '#10B981' : 'var(--clr-primary)',
                      }}
                    >
                      {badgeLabel}
                    </span>
                    <span style={{ fontSize: '0.74rem', color: 'var(--clr-ink-muted)', fontWeight: 600 }}>
                      {journey.transfersCount === 0
                        ? (lang === 'am' ? 'ያለ ቅያሪ' : 'Direct')
                        : (lang === 'am' ? '1 የታክሲ ቅያሪ' : '1 Transfer')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--clr-ink)' }}>
                      {journey.totalDurationMinutes} {lang === 'am' ? 'ደቂቃ' : 'min'}
                    </span>
                    {journey.totalFareBirr > 0 && (
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#EA580C' }}>
                        · {journey.totalFareBirr} Br
                      </span>
                    )}
                  </div>
                </div>

                {/* Timeline visual representation */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, overflowX: 'auto', paddingBottom: 4 }}>
                  {journey.steps.map((st, sIdx) => {
                    const isTaxi = st.kind === 'ride_taxi' || st.kind === 'intercept_taxi';
                    return (
                      <div key={sIdx} style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '3px 7px',
                            borderRadius: 100,
                            background: isTaxi ? 'rgba(14, 116, 144, 0.12)' : 'var(--clr-border)',
                            color: isTaxi ? '#0E7490' : 'var(--clr-ink-muted)',
                          }}
                        >
                          {st.kind === 'intercept_taxi' ? '🚕 Intercept' : st.kind === 'ride_taxi' ? '🚐 Taxi' : '🚶 Walk'}
                          <span style={{ fontSize: '0.7rem', opacity: 0.85 }}>{st.durationMinutes}m</span>
                        </span>
                        {sIdx < journey.steps.length - 1 && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--clr-border)', fontWeight: 800 }}>➔</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Step-by-Step details (expanded if selected) */}
                {isSelected && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--clr-border)', paddingTop: 10 }}>
                    {journey.steps.map((st, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 10 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 22 }}>
                          <span
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: '50%',
                              background: st.kind === 'ride_taxi' ? '#0E7490' : st.kind === 'intercept_taxi' ? '#F59E0B' : st.kind === 'arrive_destination' ? '#10B981' : 'var(--clr-border)',
                              color: '#FFFFFF',
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {idx + 1}
                          </span>
                          {idx < journey.steps.length - 1 && (
                            <span style={{ width: 2, flex: 1, minHeight: 18, background: 'var(--clr-border)', margin: '2px 0' }} />
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--clr-ink)' }}>
                            {lang === 'am' ? st.title_am : st.title_en}
                          </div>
                          {(st.desc_am || st.desc_en) && (
                            <div style={{ fontSize: '0.76rem', color: 'var(--clr-ink-muted)', marginTop: 2 }}>
                              {lang === 'am' ? st.desc_am : st.desc_en}
                            </div>
                          )}
                          {st.woyalaCallout && (
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                marginTop: 4,
                                padding: '2px 8px',
                                borderRadius: 100,
                                background: 'rgba(234, 88, 12, 0.12)',
                                color: '#EA580C',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                              }}
                            >
                              📢 ረዳት ጥሪ፡ "{st.woyalaCallout}"
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
