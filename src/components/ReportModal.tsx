import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useToast, BottomSheet } from './ui/index';
import type { Station, Line } from '../types';

export type ReportCategory = 'fare_change' | 'landmark' | 'add_line' | 'wrong_spot' | 'station_closed' | 'general_comment';

interface ReportModalProps {
  open: boolean;
  onClose: () => void;
  station: Station;
  lines: Line[];
  targetLine?: Line | null;
  initialCategory?: ReportCategory;
}

export function ReportModal({
  open,
  onClose,
  station,
  lines,
  targetLine,
  initialCategory,
}: ReportModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { show } = useToast();

  const [category, setCategory] = useState<ReportCategory>(initialCategory || (targetLine ? 'fare_change' : 'general_comment'));
  const [selectedLineId, setSelectedLineId] = useState<string>(targetLine?.id ?? '');
  const [suggestedFare, setSuggestedFare] = useState<string>('');
  const [suggestedLandmark, setSuggestedLandmark] = useState<string>('');
  const [newDestName, setNewDestName] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Sync state when props change
  useEffect(() => {
    if (open) {
      if (initialCategory) {
        setCategory(initialCategory);
      } else if (targetLine) {
        setCategory('fare_change');
      }
      if (targetLine) {
        setSelectedLineId(targetLine.id);
      }
    }
  }, [open, targetLine, initialCategory]);

  const activeLine = lines.find(l => l.id === selectedLineId) || targetLine;

  const resetForm = () => {
    setCategory('general_comment');
    setSelectedLineId('');
    setSuggestedFare('');
    setSuggestedLandmark('');
    setNewDestName('');
    setComment('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      show('Please sign in to submit a report or comment.', 'danger');
      return;
    }

    // Validation
    if (category === 'fare_change' && !suggestedFare.trim() && !comment.trim()) {
      show('Please provide a suggested new fare or comment.', 'danger');
      return;
    }
    if (category === 'landmark' && !suggestedLandmark.trim() && !comment.trim()) {
      show('Please describe the landmark or stand location.', 'danger');
      return;
    }
    if (category === 'add_line' && (!newDestName.trim() || !suggestedFare.trim())) {
      show('Please provide the destination name and fare.', 'danger');
      return;
    }
    if ((category === 'wrong_spot' || category === 'station_closed' || category === 'general_comment') && !comment.trim()) {
      show('Please provide a comment or description.', 'danger');
      return;
    }

    setLoading(true);

    const payload = {
      category,
      station_id: station.id,
      station_name: station.name_am || station.name_en,
      station_name_en: station.name_en,
      station_name_am: station.name_am,
      current_landmark: station.landmark_am || station.landmark_en || null,
      target_part: category === 'fare_change' ? 'line' : category === 'landmark' ? 'landmark' : 'station',
      line_id: activeLine?.id ?? null,
      destination_name: activeLine ? (activeLine.destination_am || activeLine.destination_en) : null,
      current_fare: activeLine?.fare_birr ?? null,
      suggested_fare: suggestedFare ? parseInt(suggestedFare, 10) : null,
      suggested_landmark: suggestedLandmark.trim() || null,
      suggested_new_dest: newDestName.trim() || null,
      comment: comment.trim(),
      created_at: new Date().toISOString(),
    };

    try {
      const { error } = await supabase.from('submissions').insert({
        type: category === 'general_comment' ? 'report' : 'edit_station',
        station_id: station.id,
        payload,
        submitter_id: user.id,
        status: 'pending',
      });

      if (error) throw error;

      show('✓ Thank you! Your suggestion / comment has been sent to review.', 'success');
      handleClose();
    } catch (err: unknown) {
      console.error('Report submission failed:', err);
      const msg = err && typeof err === 'object' && 'message' in err
        ? (err as { message: string }).message
        : 'Could not send report. Please try again.';
      show(msg, 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={handleClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Suggest Change / Comment</h2>
          <p className="text-xs text-muted" style={{ marginTop: 2 }}>
            Help keep {station.name_am || station.name_en} accurate for all commuters
          </p>
        </div>
        <button
          onClick={handleClose}
          className="btn btn-ghost"
          style={{ width: 32, height: 32, minHeight: 32, minWidth: 32, padding: 0, borderRadius: '50%', background: 'var(--clr-soft)', fontSize: '0.85rem' }}
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {!user ? (
        <div style={{
          padding: 16, background: 'var(--clr-soft)', borderRadius: 'var(--radius)',
          textAlign: 'center', marginBottom: 12, border: '1px solid var(--clr-border)',
        }}>
          <div style={{ fontSize: '1.8rem', marginBottom: 6 }}>🔒</div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 4 }}>Sign in to submit feedback</div>
          <p className="text-xs text-muted" style={{ marginBottom: 12 }}>
            Takes only 10 seconds. Helps prevent spam and awards you contributor points.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-full"
            onClick={() => { handleClose(); navigate('/login'); }}
          >
            Sign In / Sign Up →
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Part / Category Selector */}
          <div className="field">
            <label className="field-label">Which part do you want to comment or update?</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { id: 'fare_change', icon: '💰', label: 'Fare Change' },
                { id: 'landmark', icon: '📍', label: 'Landmark / Spot' },
                { id: 'add_line', icon: '🚌', label: 'Missing Line' },
                { id: 'general_comment', icon: '💬', label: 'Rider Comment' },
                { id: 'wrong_spot', icon: '🗺️', label: 'Moved Location' },
                { id: 'station_closed', icon: '🚫', label: 'Station Closed' },
              ].map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id as ReportCategory)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: category === cat.id ? '2px solid var(--clr-primary)' : '1px solid var(--clr-border)',
                    background: category === cat.id ? 'var(--clr-soft)' : 'var(--clr-surface)',
                    color: category === cat.id ? 'var(--clr-primary)' : 'var(--clr-ink)',
                    fontWeight: category === cat.id ? 700 : 500,
                    fontSize: '0.82rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: '1rem' }}>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 1. Fare Change Section */}
          {category === 'fare_change' && (
            <div style={{ background: 'var(--clr-soft)', padding: 12, borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="field">
                <label className="field-label">Destination Line</label>
                <select
                  className="input"
                  value={selectedLineId}
                  onChange={e => setSelectedLineId(e.target.value)}
                  style={{ background: 'var(--clr-surface)', color: 'var(--clr-ink)' }}
                >
                  <option value="">-- Choose destination --</option>
                  {lines.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.destination_am || l.destination_en} (Current: {l.fare_birr} birr)
                    </option>
                  ))}
                </select>
              </div>

              {activeLine && (
                <div style={{ fontSize: '0.82rem', color: 'var(--clr-ink-muted)' }}>
                  Current recorded fare: <strong style={{ color: 'var(--clr-ink)' }}>{activeLine.fare_birr} birr</strong>
                </div>
              )}

              <div className="field">
                <label className="field-label">New / Correct Fare (in Birr)</label>
                <input
                  className="input"
                  type="number"
                  min="1"
                  max="500"
                  placeholder="e.g. 25"
                  value={suggestedFare}
                  onChange={e => setSuggestedFare(e.target.value)}
                  style={{ background: 'var(--clr-surface)', color: 'var(--clr-ink)' }}
                />
              </div>
            </div>
          )}

          {/* 2. Landmark Section */}
          {category === 'landmark' && (
            <div style={{ background: 'var(--clr-soft)', padding: 12, borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(station.landmark_am || station.landmark_en) && (
                <div style={{ fontSize: '0.82rem', color: 'var(--clr-ink-muted)' }}>
                  Current landmark: <strong>{station.landmark_am || station.landmark_en}</strong>
                </div>
              )}
              <div className="field">
                <label className="field-label">Corrected Landmark / Where to Stand</label>
                <input
                  className="input"
                  placeholder="e.g. In front of Zefmesh mall gate 2"
                  value={suggestedLandmark}
                  onChange={e => setSuggestedLandmark(e.target.value)}
                  style={{ background: 'var(--clr-surface)', color: 'var(--clr-ink)' }}
                />
              </div>
            </div>
          )}

          {/* 3. Add Missing Destination Section */}
          {category === 'add_line' && (
            <div style={{ background: 'var(--clr-soft)', padding: 12, borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="field">
                <label className="field-label">New Destination Name</label>
                <input
                  className="input"
                  placeholder="e.g. Ayat Real Estate / አያት ሪል እስቴት"
                  value={newDestName}
                  onChange={e => setNewDestName(e.target.value)}
                  style={{ background: 'var(--clr-surface)', color: 'var(--clr-ink)' }}
                />
              </div>
              <div className="field">
                <label className="field-label">Fare (in Birr)</label>
                <input
                  className="input"
                  type="number"
                  min="1"
                  max="500"
                  placeholder="e.g. 25"
                  value={suggestedFare}
                  onChange={e => setSuggestedFare(e.target.value)}
                  style={{ background: 'var(--clr-surface)', color: 'var(--clr-ink)' }}
                />
              </div>
            </div>
          )}

          {/* Comment / Note Box */}
          <div className="field">
            <label className="field-label">
              {category === 'fare_change' ? 'Comment (Optional note for admin)' : 'Your Comment / Details'}
            </label>
            <textarea
              className="input"
              rows={3}
              placeholder={
                category === 'fare_change'
                  ? 'e.g. Fares went up yesterday due to route change...'
                  : category === 'landmark'
                    ? 'e.g. The line moved 50 meters down the street near the bank...'
                    : category === 'wrong_spot'
                      ? 'Explain where the queue actually begins...'
                      : category === 'station_closed'
                        ? 'Reason or when the station was relocated/closed...'
                        : 'Write your tip, queue note, or report...'
              }
              value={comment}
              onChange={e => setComment(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading}
            style={{ marginTop: 4 }}
          >
            {loading ? 'Submitting…' : '✓ Submit for Review'}
          </button>
        </form>
      )}
    </BottomSheet>
  );
}
