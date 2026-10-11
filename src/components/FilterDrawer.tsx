import { useState, useEffect } from 'react';
import { BottomSheet } from './ui/index';

interface FilterDrawerProps {
  open: boolean;
  onClose: () => void;
  maxFare: number;
  verifiedOnly?: boolean;
  onApply: (maxFare: number, verifiedOnly: boolean) => void;
  onReset: () => void;
  stationCount: number;
}

export function FilterDrawer({
  open,
  onClose,
  maxFare: initialMaxFare,
  verifiedOnly: initialVerifiedOnly = false,
  onApply,
  onReset,
  stationCount,
}: FilterDrawerProps) {
  const [fare, setFare] = useState(initialMaxFare || 45);
  const [ratingFilter, setRatingFilter] = useState(4);
  const [verifiedOnly, setVerifiedOnly] = useState(initialVerifiedOnly);

  // Sync state whenever drawer opens
  useEffect(() => {
    if (open) {
      setFare(initialMaxFare || 45);
      setVerifiedOnly(initialVerifiedOnly);
    }
  }, [open, initialMaxFare, initialVerifiedOnly]);

  // Histogram heights representing Addis taxi fare distribution
  const histogramBars = [
    14, 22, 38, 55, 82, 95, 78, 62, 48, 35, 26, 18, 14, 10, 8, 6
  ];

  const handleApply = () => {
    onApply(fare, verifiedOnly);
    onClose();
  };

  const handleReset = () => {
    setFare(50);
    setRatingFilter(4);
    setVerifiedOnly(false);
    onReset();
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} className="filter-drawer-sheet">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 10 }}>
        {/* Title */}
        <div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--clr-ink)', letterSpacing: '-0.02em' }}>
            Taxi Filters
          </h2>
          <p className="text-xs text-muted" style={{ marginTop: 2 }}>
            Filter {stationCount} stations across Addis Ababa
          </p>
        </div>

        {/* Price Range Section */}
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--clr-ink-muted)', marginBottom: 12 }}>
            Price range
          </div>

          {/* Histogram bar chart */}
          <div style={{
            display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
            height: 52, gap: 3, padding: '0 4px', marginBottom: 6,
          }}>
            {histogramBars.map((height, i) => {
              const barValue = 8 + (i * 2);
              const isIncluded = barValue <= fare;
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: `${height}%`,
                    background: isIncluded ? 'var(--clr-primary-glow)' : 'var(--clr-soft)',
                    borderRadius: '3px 3px 0 0',
                    transition: 'background 0.2s',
                  }}
                />
              );
            })}
          </div>

          {/* Range Slider Track */}
          <div style={{ position: 'relative', width: '100%', padding: '8px 0' }}>
            <input
              type="range"
              min="8"
              max="50"
              step="1"
              value={fare}
              onChange={e => setFare(Number(e.target.value))}
              style={{
                width: '100%',
                accentColor: 'var(--clr-primary)',
                cursor: 'pointer',
              }}
            />
          </div>

          {/* Price Range Callouts */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginTop: 6, paddingTop: 6, borderBottom: '1px solid var(--clr-border)', paddingBottom: 16,
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--clr-ink-muted)' }}>Min fare</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--clr-ink)' }}>
                8.00 Br
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--clr-ink-muted)' }}>Max fare</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--clr-primary)' }}>
                {fare >= 50 ? 'Any (50+ Br)' : `${fare.toFixed(2)} Br`}
              </div>
            </div>
          </div>
        </div>

        {/* Rating / Quality Section */}
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--clr-ink-muted)', marginBottom: 12 }}>
            Station Verification
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {/* Stars */}
            <div style={{ display: 'flex', gap: 4, cursor: 'pointer' }}>
              {[1, 2, 3, 4, 5].map(star => (
                <span
                  key={star}
                  onClick={() => setRatingFilter(star)}
                  style={{
                    fontSize: '1.4rem',
                    color: star <= ratingFilter ? '#FFAE1A' : 'var(--clr-border)',
                    transition: 'transform 0.15s',
                  }}
                >
                  ★
                </span>
              ))}
            </div>

            {/* Premium / Verified badge toggle */}
            <button
              type="button"
              onClick={() => setVerifiedOnly(!verifiedOnly)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 12,
                border: verifiedOnly ? '1.5px solid #F59E0B' : '1.5px solid var(--clr-border)',
                background: verifiedOnly ? 'rgba(245, 158, 11, 0.12)' : 'var(--clr-surface)',
                color: verifiedOnly ? '#F59E0B' : 'var(--clr-ink-muted)',
                fontWeight: 700,
                fontSize: '0.75rem',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              <span>👑</span>
              <span>VERIFIED ONLY</span>
            </button>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{
              flex: 2, height: 50, borderRadius: 16,
              background: 'var(--clr-primary)', color: '#fff', fontWeight: 700, fontSize: '0.95rem',
              boxShadow: '0 8px 24px rgba(110, 86, 207, 0.35)',
            }}
            onClick={handleApply}
          >
            APPLY FILTERS
          </button>
          <button
            type="button"
            className="btn"
            style={{
              flex: 1, height: 50, borderRadius: 16,
              background: 'var(--clr-soft)', color: 'var(--clr-primary)', fontWeight: 700, fontSize: '0.95rem',
              border: '1px solid var(--clr-border)',
            }}
            onClick={handleReset}
          >
            RESET
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
