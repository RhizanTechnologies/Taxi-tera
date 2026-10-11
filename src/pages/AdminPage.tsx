import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Spinner } from '../components/ui/index';
import { timeAgo, distanceMetres, pickName } from '../lib/utils';
import type { Submission, Profile, Station } from '../types';

interface QueueItem extends Submission {
  submitter?: Profile;
}

const proposedPinIcon = L.divIcon({
  html: `<div style="background:#087E8B;color:#fff;border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 4px 12px rgba(8,126,139,0.35);">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.6-.1-1.1-.3-1.6l-1.4-3.6C20 8.3 19.5 8 19 8H5c-.5 0-1 .3-1.3.8L2.3 12.4c-.2.5-.3 1-.3 1.6 0 .4.1.8.2 1.2.3 1.1.8 2.8.8 2.8h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/>
    </svg>
  </div>`,
  className: '',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

const submitterPinIcon = L.divIcon({
  html: `<div style="background:#D9F56D;color:#102A43;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2.5px solid #102A43;box-shadow:0 2px 8px rgba(16,42,67,0.25);">GPS</div>`,
  className: '',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

const existingPinIcon = L.divIcon({
  html: `<div style="background:#102A43;color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 6px rgba(16,42,67,0.25);">•</div>`,
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const destPinIcon = L.divIcon({
  html: `<div style="background:#102A43;color:#D9F56D;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2.5px solid #fff;box-shadow:0 3px 10px rgba(16,42,67,0.3);">B</div>`,
  className: '',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const stopPinIcon = L.divIcon({
  html: `<div style="background:#087E8B;color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 8px rgba(8,126,139,0.3);">•</div>`,
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function AdminBoundsFitter({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points && points.length >= 2 && map) {
      try {
        const bounds = L.latLngBounds(points.map(([lat, lng]) => [lat, lng]));
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [35, 35], maxZoom: 15, animate: false });
        }
      } catch (err) {
        console.warn('AdminBoundsFitter fitBounds ignored:', err);
      }
    }
  }, [points, map]);
  return null;
}

export default function AdminPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<'queue' | 'tools'>('queue');
  const [filter, setFilter] = useState<'all' | 'reports' | 'new_stations'>('all');
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [items, setItems] = useState<QueueItem[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [adminActiveLineIdx, setAdminActiveLineIdx] = useState<number | null>(0);

  useEffect(() => {
    if (!authLoading && profile?.role !== 'admin') navigate('/');
  }, [profile, authLoading, navigate]);

  const loadQueue = async (currentStatus = statusFilter) => {
    setLoading(true);
    let q = supabase
      .from('submissions')
      .select('*')
      .order('created_at', { ascending: false });

    if (currentStatus !== 'all') {
      q = q.eq('status', currentStatus);
    }

    const { data, error } = await q;
    if (error) console.error('Error loading submissions:', error);
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadQueue(statusFilter);
    supabase
      .from('stations')
      .select('*')
      .in('status', ['active', 'closed'])
      .then(({ data }) => setStations(data ?? []));
  }, [statusFilter]);

  const approve = async (id: string) => {
    setActionLoading(true);
    const sub = items.find(i => i.id === id);
    if (!sub) {
      setActionLoading(false);
      return;
    }

    try {
      // 1. Try DB RPC function
      const { error: rpcErr } = await supabase.rpc('approve_submission', { submission_id: id });

      if (rpcErr) {
        console.warn('RPC approve_submission failed, applying direct fallback:', rpcErr);

        // 2. Direct client fallback to ensure suggestion is stored & applied
        const p = sub.payload as Record<string, any>;

        if (sub.type === 'new_station') {
          const { data: newSt, error: stErr } = await supabase.from('stations').insert({
            name_am: p.name_am,
            name_en: p.name_en,
            lat: Number(p.lat),
            lng: Number(p.lng),
            landmark_am: p.landmark_am,
            landmark_en: p.landmark_en,
            status: 'active',
            last_verified_at: new Date().toISOString(),
          }).select().single();

          if (!stErr && newSt && Array.isArray(p.lines)) {
            const linesToInsert = p.lines.map((l: any, idx: number) => ({
              station_id: newSt.id,
              destination_am: l.destination_am,
              destination_en: l.destination_en,
              fare_birr: Number(l.fare_birr),
              direction: l.direction,
              fare_checked_at: new Date().toISOString(),
              sort_order: idx + 1,
            }));
            await supabase.from('lines').insert(linesToInsert);
          }
        } else if (sub.station_id) {
          if (p.suggested_landmark) {
            await supabase.from('stations').update({
              landmark_am: p.suggested_landmark,
              last_verified_at: new Date().toISOString(),
            }).eq('id', sub.station_id);
          }

          if (p.line_id && p.suggested_fare) {
            await supabase.from('lines').update({
              fare_birr: Number(p.suggested_fare),
              fare_checked_at: new Date().toISOString(),
            }).eq('id', p.line_id);

            await supabase.from('stations').update({
              last_verified_at: new Date().toISOString(),
            }).eq('id', sub.station_id);
          }

          if (p.suggested_new_dest && p.suggested_fare) {
            await supabase.from('lines').insert({
              station_id: sub.station_id,
              destination_am: p.suggested_new_dest,
              destination_en: p.suggested_new_dest,
              fare_birr: Number(p.suggested_fare),
              fare_checked_at: new Date().toISOString(),
              sort_order: 99,
            });

            await supabase.from('stations').update({
              last_verified_at: new Date().toISOString(),
            }).eq('id', sub.station_id);
          }

          if (p.category === 'station_closed' || p.action === 'closed') {
            await supabase.from('stations').update({ status: 'closed' }).eq('id', sub.station_id);
          }
        }

        // Update submission status in database
        await supabase.from('submissions').update({
          status: 'approved',
          reviewer_id: profile?.id,
          reviewed_at: new Date().toISOString(),
        }).eq('id', id);
      }

      // Update in local state
      if (statusFilter === 'pending') {
        setItems(prev => prev.filter(i => i.id !== id));
      } else {
        setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'approved', reviewed_at: new Date().toISOString() } : i));
      }
      setSelectedId(null);
      // Reload stations
      supabase.from('stations').select('*').in('status', ['active', 'closed']).then(({ data }) => setStations(data ?? []));
    } catch (e: unknown) {
      console.error('Approve failed:', e);
      alert('Could not approve submission. Check database permissions.');
    } finally {
      setActionLoading(false);
    }
  };

  const reject = async (id: string) => {
    setActionLoading(true);
    const note = rejectNote || 'Dismissed by admin';
    try {
      const { error: rpcErr } = await supabase.rpc('reject_submission', { submission_id: id, note });
      if (rpcErr) {
        console.warn('RPC reject_submission failed, applying direct update fallback:', rpcErr);
        await supabase.from('submissions').update({
          status: 'rejected',
          reviewer_note: note,
          reviewer_id: profile?.id,
          reviewed_at: new Date().toISOString(),
        }).eq('id', id);
      }
      if (statusFilter === 'pending') {
        setItems(prev => prev.filter(i => i.id !== id));
      } else {
        setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'rejected', reviewer_note: note, reviewed_at: new Date().toISOString() } : i));
      }
      setSelectedId(null);
      setRejectNote('');
    } catch (e: unknown) {
      console.error('Reject failed:', e);
      alert('Could not reject submission.');
    } finally {
      setActionLoading(false);
    }
  };

  const selected = items.find(i => i.id === selectedId);

  const reportCount = items.filter(i => i.type === 'report' || i.type === 'edit_station').length;
  const newStationCount = items.filter(i => i.type === 'new_station').length;
  const displayedItems = filter === 'reports'
    ? items.filter(i => i.type === 'report' || i.type === 'edit_station')
    : filter === 'new_stations'
    ? items.filter(i => i.type === 'new_station')
    : items;

  if (authLoading) return <div className="flex-center" style={{ height: '100%' }}><Spinner /></div>;

  return (
    <div className="admin-page">
      {/* Header */}
      <div className="app-header">
        <button className="btn btn-ghost" style={{ minWidth: 44, padding: '0 8px' }} onClick={() => navigate('/')}>←</button>
        <span className="app-header-title">
          {t('admin.title')}
          {items.length > 0 && <span className="admin-badge">{items.length}</span>}
        </span>
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        <button
          className={`admin-tab ${tab === 'queue' ? 'active' : ''}`}
          onClick={() => setTab('queue')}
        >
          {t('admin.queue')}
          {items.length > 0 && <span className="admin-badge">{items.length}</span>}
        </button>
        <button
          className={`admin-tab ${tab === 'tools' ? 'active' : ''}`}
          onClick={() => setTab('tools')}
        >
          {t('admin.tools')}
        </button>
      </div>

      {/* Queue tab */}
      {tab === 'queue' && (
        <div className="admin-queue">
          {/* Status Filters: Pending, Approved, Rejected, All */}
          <div style={{ display: 'flex', gap: 8, padding: '10px 16px', background: 'var(--clr-surface)', borderBottom: '1px solid var(--clr-border)', overflowX: 'auto' }}>
            {(['pending', 'approved', 'rejected', 'all'] as const).map(st => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                style={{
                  padding: '5px 14px', borderRadius: 100, border: 'none', cursor: 'pointer',
                  background: statusFilter === st ? 'var(--clr-primary)' : 'var(--clr-soft)',
                  color: statusFilter === st ? '#fff' : 'var(--clr-ink)',
                  fontSize: '0.82rem', fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <span>{st === 'pending' ? '🕒' : st === 'approved' ? '✅' : st === 'rejected' ? '✕' : '📋'}</span>
                <span style={{ textTransform: 'capitalize' }}>{st === 'all' ? 'All Statuses' : st}</span>
              </button>
            ))}
          </div>

          {/* Sub-filters by Type */}
          <div style={{ display: 'flex', gap: 8, padding: '10px 16px', background: 'var(--clr-surface)', borderBottom: '1px solid var(--clr-border)', overflowX: 'auto' }}>
            <button
              onClick={() => setFilter('all')}
              style={{
                padding: '5px 12px', borderRadius: 100, border: 'none', cursor: 'pointer',
                background: filter === 'all' ? 'var(--clr-ink)' : 'var(--clr-soft)',
                color: filter === 'all' ? '#fff' : 'var(--clr-ink)',
                fontSize: '0.8rem', fontWeight: 600,
              }}
            >
              All Types ({items.length})
            </button>
            <button
              onClick={() => setFilter('reports')}
              style={{
                padding: '6px 14px', borderRadius: 100, border: 'none', cursor: 'pointer',
                background: filter === 'reports' ? 'var(--clr-primary)' : 'var(--clr-soft)',
                color: filter === 'reports' ? '#fff' : 'var(--clr-ink)',
                fontSize: '0.82rem', fontWeight: 600,
              }}
            >
              ⚑ Reports & Changes ({reportCount})
            </button>
            <button
              onClick={() => setFilter('new_stations')}
              style={{
                padding: '6px 14px', borderRadius: 100, border: 'none', cursor: 'pointer',
                background: filter === 'new_stations' ? 'var(--clr-primary)' : 'var(--clr-soft)',
                color: filter === 'new_stations' ? '#fff' : 'var(--clr-ink)',
                fontSize: '0.82rem', fontWeight: 600,
              }}
            >
              🚐 New Stations ({newStationCount})
            </button>
          </div>

          {loading && <div className="flex-center" style={{ padding: 40 }}><Spinner /></div>}

          {!loading && displayedItems.length === 0 && (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>✅</div>
              <h2>{t('admin.noItems')}</h2>
              <p className="text-sm text-muted">All review requests have been handled!</p>
            </div>
          )}

          {/* Lightbox for Photos */}
          {lightboxImg && (
            <div
              onClick={() => setLightboxImg(null)}
              style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)',
                zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 16, cursor: 'zoom-out',
              }}
            >
              <img
                src={lightboxImg}
                alt="Enlarged station"
                style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }}
              />
            </div>
          )}

          {/* Review detail */}
          {selected && (() => {
            const p = selected.payload as Record<string, unknown>;
            const isReportOrEdit = selected.type === 'report' || (selected.type === 'edit_station' && !p.lat);

            // ── VIEW A: REPORT OR CHANGE SUGGESTION REVIEW ──
            if (isReportOrEdit) {
              const stationName = String(p.station_name || p.name_am || p.name_en || 'Station');
              const category = String(p.category || 'general_comment');

              const getCategoryBadge = () => {
                switch (category) {
                  case 'fare_change':
                    return { label: '💰 Fare Change Suggestion', color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' };
                  case 'landmark':
                    return { label: '📍 Landmark / Spot Update', color: '#D97706', bg: 'rgba(245, 158, 11, 0.12)' };
                  case 'add_line':
                    return { label: '🚌 Missing Line Request', color: '#1F4FA3', bg: 'rgba(31, 79, 163, 0.12)' };
                  case 'station_closed':
                    return { label: '🚫 Station Closed Report', color: '#DC2626', bg: 'rgba(239, 68, 68, 0.12)' };
                  case 'wrong_spot':
                    return { label: '🗺️ Wrong Spot / Moved', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.12)' };
                  default:
                    return { label: '💬 Commuter Comment & Feedback', color: '#4E5D7A', bg: 'rgba(78, 93, 122, 0.12)' };
                }
              };

              const badge = getCategoryBadge();

              return (
                <div style={{
                  position: 'fixed', inset: 0, background: 'var(--clr-surface)', zIndex: 950,
                  display: 'flex', flexDirection: 'column', overflowY: 'auto',
                }}>
                  {/* Detail Header */}
                  <div className="app-header">
                    <button className="btn btn-ghost" style={{ minWidth: 44, padding: '0 8px' }}
                      onClick={() => { setSelectedId(null); setRejectNote(''); }}>← Back</button>
                    <span className="app-header-title">Review Suggestion / Report</span>
                  </div>

                  <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, flex: 1, maxWidth: 640, margin: '0 auto', width: '100%' }}>
                    {/* Badge & Time */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        padding: '4px 12px', borderRadius: 100, fontSize: '0.84rem', fontWeight: 700,
                        color: badge.color, background: badge.bg,
                      }}>
                        {badge.label}
                      </span>
                      <span className="text-xs text-muted">{timeAgo(selected.created_at)}</span>
                    </div>

                    {/* Target Station Card */}
                    <div className="card" style={{ padding: 16 }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--clr-ink-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                        Station
                      </div>
                      <h2 style={{ fontSize: '1.25rem', marginBottom: 2 }}>{stationName}</h2>
                      {Boolean(p.current_landmark) && (
                        <div style={{ fontSize: '0.86rem', color: 'var(--clr-ink-muted)', marginTop: 4 }}>
                          📍 Current spot: {String(p.current_landmark)}
                        </div>
                      )}
                      {selected.station_id && (
                        <div style={{ marginTop: 10 }}>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            style={{ fontSize: '0.75rem', padding: '4px 10px', color: 'var(--clr-primary)', background: 'var(--clr-soft)', borderRadius: 100 }}
                            onClick={() => window.open(`/station/${selected.station_id}`, '_blank')}
                          >
                            Open station page ↗
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Fare Change Detail */}
                    {category === 'fare_change' && (
                      <div className="card" style={{ padding: 16, borderLeft: '4px solid #10B981' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--clr-ink-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                          Proposed Fare Update
                        </div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 10 }}>
                          Destination: {String(p.destination_name || 'Destination Line')}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', background: 'var(--clr-soft)', borderRadius: 'var(--radius)' }}>
                          <div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--clr-ink-muted)' }}>Recorded Fare</div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 600, textDecoration: p.suggested_fare ? 'line-through' : 'none', color: 'var(--clr-ink-muted)' }}>
                              {p.current_fare != null ? `${p.current_fare} birr` : '—'}
                            </div>
                          </div>
                          <span style={{ fontSize: '1.2rem', color: 'var(--clr-ink-muted)' }}>➔</span>
                          <div>
                            <div style={{ fontSize: '0.72rem', color: '#10B981', fontWeight: 700 }}>Suggested New Fare</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10B981' }}>
                              {String(p.suggested_fare)} birr
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Landmark Detail */}
                    {category === 'landmark' && (
                      <div className="card" style={{ padding: 16, borderLeft: '4px solid #D97706' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--clr-ink-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                          Proposed Landmark / Where to Stand
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--clr-ink-muted)', marginBottom: 4 }}>Submitter's suggested spot:</div>
                        <div style={{ fontSize: '0.98rem', fontWeight: 600, padding: '10px 14px', background: 'var(--clr-soft)', borderRadius: 'var(--radius)' }}>
                          {String(p.suggested_landmark || p.comment || '—')}
                        </div>
                      </div>
                    )}

                    {/* Add Line Detail */}
                    {category === 'add_line' && (
                      <div className="card" style={{ padding: 16, borderLeft: '4px solid #1F4FA3' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--clr-ink-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                          New Destination Line Request
                        </div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                          {String(p.suggested_new_dest)}
                        </div>
                        <div style={{ fontSize: '0.95rem', color: 'var(--clr-primary)', fontWeight: 700, marginTop: 4 }}>
                          Suggested Fare: {String(p.suggested_fare)} birr
                        </div>
                      </div>
                    )}

                    {/* Station Closed Alert */}
                    {category === 'station_closed' && (
                      <div className="card" style={{ padding: 16, borderLeft: '4px solid #DC2626', background: 'rgba(239, 68, 68, 0.05)' }}>
                        <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#DC2626', marginBottom: 4 }}>
                          ⚠️ Rider Reports Station is Closed or Removed
                        </div>
                        <p className="text-xs text-muted">
                          Approving will mark this station's status as 'closed' in the database.
                        </p>
                      </div>
                    )}

                    {/* Commuter's Comment Box */}
                    {Boolean(p.comment) && (
                      <div className="card" style={{ padding: 16 }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--clr-ink-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                          💬 Commuter's Comment & Explanation
                        </div>
                        <div style={{
                          padding: '12px 14px', background: 'var(--clr-soft)', borderRadius: 'var(--radius)',
                          fontSize: '0.95rem', lineHeight: 1.5, borderLeft: '3px solid var(--clr-primary)',
                        }}>
                          "{String(p.comment)}"
                        </div>
                      </div>
                    )}

                    {/* Submitter & Time Info */}
                    <div style={{ fontSize: '0.78rem', color: 'var(--clr-ink-muted)', padding: '0 4px' }}>
                      Contributor: <code>{selected.submitter_id?.slice(0, 8) || 'User'}…</code> · Submitted {new Date(selected.created_at).toLocaleString()}
                    </div>
                  </div>

                  {/* Action Bar or Reviewed Status Banner */}
                  {selected.status === 'approved' ? (
                    <div style={{
                      padding: '14px 16px', background: 'rgba(16, 185, 129, 0.1)',
                      borderTop: '1px solid #10B981', color: '#10B981',
                      fontWeight: 700, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <span>✅ Approved by Admin</span>
                      {selected.reviewed_at && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--clr-ink-muted)', fontWeight: 500 }}>
                          · Applied on {new Date(selected.reviewed_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  ) : selected.status === 'rejected' ? (
                    <div style={{
                      padding: '14px 16px', background: 'rgba(239, 68, 68, 0.1)',
                      borderTop: '1px solid #EF4444', color: '#EF4444',
                      fontWeight: 700, fontSize: '0.92rem', display: 'flex', flexDirection: 'column', gap: 4,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>✕ Rejected</span>
                        {selected.reviewed_at && (
                          <span style={{ fontSize: '0.78rem', color: 'var(--clr-ink-muted)', fontWeight: 500 }}>
                            · {new Date(selected.reviewed_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {selected.reviewer_note && (
                        <div style={{ fontSize: '0.82rem', color: 'var(--clr-ink)', fontWeight: 500 }}>
                          Reason: "{selected.reviewer_note}"
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{
                      padding: '12px 16px', background: 'var(--clr-surface)', borderTop: '1px solid var(--clr-border)',
                      display: 'flex', flexDirection: 'column', gap: 10, position: 'sticky', bottom: 0,
                    }}>
                      <input
                        className="input"
                        placeholder="Optional dismissal note for user..."
                        value={rejectNote}
                        onChange={e => setRejectNote(e.target.value)}
                      />
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button
                          className="btn btn-danger"
                          style={{ flex: 1 }}
                          onClick={() => reject(selected.id)}
                          disabled={actionLoading}
                        >
                          Dismiss / Reject
                        </button>
                        <button
                          className="btn btn-primary"
                          style={{ flex: 2 }}
                          onClick={() => approve(selected.id)}
                          disabled={actionLoading}
                        >
                          {actionLoading ? '…' : '✓ Approve & Apply Update'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            // ── VIEW B: NEW STATION VERIFICATION VIEW (WITH MAP) ──
            const stationLat = Number(p.lat ?? selected.submitter_lat ?? 9.03);
            const stationLng = Number(p.lng ?? selected.submitter_lng ?? 38.74);
            const hasCoords = !isNaN(stationLat) && !isNaN(stationLng);
            const submitterLat = selected.submitter_lat;
            const submitterLng = selected.submitter_lng;
            const hasSubmitterGps = submitterLat != null && submitterLng != null;
            const dist = (hasCoords && hasSubmitterGps)
              ? Math.round(distanceMetres(stationLat, stationLng, submitterLat, submitterLng))
              : null;
            const nearbyExisting = stations.filter(s =>
              hasCoords && distanceMetres(stationLat, stationLng, s.lat, s.lng) < 2000
            );
            const lines = Array.isArray(p.lines) ? (p.lines as Record<string, any>[]) : [];
            const resolvedActiveLineIdx =
              adminActiveLineIdx !== null && lines[adminActiveLineIdx]
                ? adminActiveLineIdx
                : lines.findIndex((l: any) => l.route_geometry && Array.isArray(l.route_geometry) && l.route_geometry.length > 0);
            const activeLine = resolvedActiveLineIdx >= 0 ? lines[resolvedActiveLineIdx] : null;

            return (
              <div style={{
                position: 'fixed', inset: 0, background: 'var(--clr-surface)', zIndex: 950,
                display: 'flex', flexDirection: 'column', overflowY: 'auto',
              }}>
                {/* Detail header */}
                <div className="app-header">
                  <button className="btn btn-ghost" style={{ minWidth: 44, padding: '0 8px' }}
                    onClick={() => { setSelectedId(null); setRejectNote(''); }}>← Back</button>
                  <span className="app-header-title">
                    {String(p.name_am || p.name_en || 'Review New Station')}
                  </span>
                </div>

                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, flex: 1, maxWidth: 640, margin: '0 auto', width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '0.78rem', fontWeight: 700, background: 'rgba(31, 79, 163, 0.12)', color: 'var(--clr-primary)' }}>
                      🌱 New Station Submission
                    </span>
                    <span className="text-xs text-muted">{timeAgo(selected.created_at)}</span>
                  </div>

                  {/* Station Names & Landmark */}
                  <div className="card" style={{ padding: '14px 16px' }}>
                    <h2 style={{ fontSize: '1.25rem', marginBottom: 4 }}>{String(p.name_am || '—')}</h2>
                    <div style={{ fontSize: '1rem', color: 'var(--clr-ink-muted)' }}>{String(p.name_en || '—')}</div>
                    {(Boolean(p.landmark_am) || Boolean(p.landmark_en)) && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--clr-border)', fontSize: '0.9rem' }}>
                        <span style={{ fontWeight: 600, color: 'var(--clr-primary)' }}>📍 Landmark: </span>
                        {p.landmark_am ? String(p.landmark_am) : ''} {p.landmark_en ? `(${String(p.landmark_en)})` : ''}
                      </div>
                    )}
                  </div>

                  {/* Interactive Verification Map with Suggested Paths */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--clr-ink-muted)', textTransform: 'uppercase' }}>
                          Station & Suggested Route Map
                        </span>
                        {activeLine && activeLine.route_geometry && (
                          <span style={{ fontSize: '0.74rem', background: '#6E56CF', color: '#FFFFFF', padding: '2px 8px', borderRadius: 100, fontWeight: 700 }}>
                            🛣️ {String(activeLine.destination_am || activeLine.destination_en)} Path
                          </span>
                        )}
                      </div>
                      {dist !== null && (
                        <span className={`accuracy-badge ${dist <= 50 ? 'good' : 'poor'}`} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                          {dist <= 50 ? `✓ On-site (${dist}m away)` : `⚠️ Submitter was ${dist}m away`}
                        </span>
                      )}
                    </div>

                    <div className="admin-map-wrap" style={{ minHeight: 300, position: 'relative' }}>
                      <MapContainer
                        center={[stationLat, stationLng]}
                        zoom={15}
                        style={{ width: '100%', height: '100%' }}
                        zoomControl={true}
                      >
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                        {/* Proposed Station Marker */}
                        <Marker position={[stationLat, stationLng]} icon={proposedPinIcon}>
                          <Popup>
                            <strong>Proposed Station:</strong><br />
                            {String(p.name_am || '')} / {String(p.name_en || '')}
                          </Popup>
                        </Marker>

                        {/* Submitter GPS */}
                        {hasSubmitterGps && (
                          <>
                            <Marker position={[submitterLat, submitterLng]} icon={submitterPinIcon}>
                              <Popup>
                                <strong>Submitter GPS:</strong><br />
                                Location where contributor tapped submit
                              </Popup>
                            </Marker>
                            <Circle
                              center={[submitterLat, submitterLng]}
                              radius={Math.max(15, dist || 15)}
                              pathOptions={{ color: '#1F4FA3', dashArray: '4, 4', fillOpacity: 0.1 }}
                            />
                          </>
                        )}

                        {/* Suggested Real-Road Polyline */}
                        {activeLine && activeLine.route_geometry && Array.isArray(activeLine.route_geometry) && activeLine.route_geometry.length > 0 && (
                          <>
                            <Polyline
                              positions={activeLine.route_geometry}
                              pathOptions={{
                                color: '#6E56CF',
                                weight: 6,
                                opacity: 0.95,
                              }}
                            />
                            <AdminBoundsFitter points={activeLine.route_geometry} />
                          </>
                        )}

                        {/* Suggested Destination Pin */}
                        {activeLine && (activeLine.end_coords || (activeLine.route_geometry && activeLine.route_geometry.length > 0)) && (() => {
                          const destPos = activeLine.end_coords || activeLine.route_geometry[activeLine.route_geometry.length - 1];
                          return (
                            <Marker position={destPos} icon={destPinIcon}>
                              <Popup>
                                <strong>Suggested Destination:</strong><br />
                                {String(activeLine.destination_am || activeLine.destination_en || 'Dropoff Point')}
                              </Popup>
                            </Marker>
                          );
                        })()}

                        {/* Suggested Intermediate Stops Pins */}
                        {activeLine && Array.isArray(activeLine.intermediate_stops) && activeLine.intermediate_stops.map((stop: any, sIdx: number) => (
                          <Marker key={stop.id || sIdx} position={[stop.lat, stop.lng]} icon={stopPinIcon}>
                            <Popup>
                              <strong>Intermediate Stop {sIdx + 1}:</strong><br />
                              {stop.name}
                            </Popup>
                          </Marker>
                        ))}

                        {/* Nearby Existing Stations */}
                        {nearbyExisting.map(s => (
                          <Marker key={s.id} position={[s.lat, s.lng]} icon={existingPinIcon}>
                            <Popup>
                              <strong>Existing Station:</strong><br />
                              {pickName(s.name_am, s.name_en, 'am')}
                            </Popup>
                          </Marker>
                        ))}
                      </MapContainer>
                    </div>
                  </div>

                  {/* Photos */}
                  {selected.photo_paths.length > 0 && (
                    <div>
                      <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--clr-ink-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                        Photos ({selected.photo_paths.length})
                      </p>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {selected.photo_paths.map(path => {
                          const url = supabase.storage.from('station-photos').getPublicUrl(path).data.publicUrl;
                          return (
                            <img
                              key={path}
                              src={url}
                              alt="Submission photo"
                              onClick={() => setLightboxImg(url)}
                              style={{
                                width: 110, height: 110, objectFit: 'cover',
                                borderRadius: 'var(--radius)', cursor: 'pointer',
                                border: '1px solid var(--clr-border)',
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Destinations, Fares & Suggested Real-Road Paths */}
                  {lines.length > 0 && (
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                      <div style={{
                        padding: '10px 16px', background: 'var(--clr-soft)',
                        fontSize: '0.8rem', fontWeight: 700, color: 'var(--clr-ink-muted)',
                        textTransform: 'uppercase', borderBottom: '1px solid var(--clr-border)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}>
                        <span>Destinations & Suggested Paths ({lines.length})</span>
                        <span style={{ fontSize: '0.72rem', color: '#6E56CF', textTransform: 'none' }}>
                          Tap "View Path" to preview on map
                        </span>
                      </div>
                      <div>
                        {lines.map((l: any, i: number) => {
                          const isLineActive = resolvedActiveLineIdx === i;
                          const hasPath = l.route_geometry && Array.isArray(l.route_geometry) && l.route_geometry.length > 0;
                          const stopsCount = Array.isArray(l.intermediate_stops) ? l.intermediate_stops.length : 0;

                          return (
                            <div
                              key={i}
                              style={{
                                padding: '12px 16px',
                                borderBottom: i < lines.length - 1 ? '1px solid var(--clr-border)' : 'none',
                                background: isLineActive && hasPath ? 'rgba(110, 86, 207, 0.06)' : undefined,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 6,
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: '0.98rem' }}>
                                    {String(l.destination_am || l.destination_en || '—')}
                                  </div>
                                  {l.via_corridor && (
                                    <div style={{ fontSize: '0.78rem', color: 'var(--clr-ink-muted)', marginTop: 1 }}>
                                      🛣️ {l.via_corridor}
                                    </div>
                                  )}
                                </div>
                                <div style={{ fontWeight: 800, color: 'var(--clr-primary)', fontSize: '1.05rem' }}>
                                  {String(l.fare_birr)} birr
                                </div>
                              </div>

                              {/* Real-Road Path details & Interactive Map Toggle */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                                {hasPath ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '0.74rem', fontWeight: 750, color: '#10B981', background: 'rgba(16, 185, 129, 0.12)', padding: '2px 8px', borderRadius: 100 }}>
                                      ✓ Real Road Path ({l.route_distance_meters ? `${(l.route_distance_meters / 1000).toFixed(1)} km` : `${l.route_geometry.length} points`})
                                    </span>
                                    {stopsCount > 0 && (
                                      <span style={{ fontSize: '0.74rem', color: '#D97706', background: 'rgba(245, 158, 11, 0.12)', padding: '2px 8px', borderRadius: 100, fontWeight: 700 }}>
                                        📍 {stopsCount} pickup stop{stopsCount !== 1 ? 's' : ''}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span style={{ fontSize: '0.74rem', color: 'var(--clr-ink-muted)' }}>
                                    No custom path marked (direct highway)
                                  </span>
                                )}

                                {hasPath && (
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    style={{
                                      fontSize: '0.75rem',
                                      padding: '4px 10px',
                                      minHeight: 28,
                                      borderRadius: 100,
                                      fontWeight: 700,
                                      background: isLineActive ? '#6E56CF' : undefined,
                                      color: isLineActive ? '#FFFFFF' : undefined,
                                      borderColor: isLineActive ? '#6E56CF' : undefined,
                                    }}
                                    onClick={() => setAdminActiveLineIdx(isLineActive ? null : i)}
                                  >
                                    {isLineActive ? '👁️ Viewing on Map' : '🗺️ View Path on Map'}
                                  </button>
                                )}
                              </div>

                              {/* Intermediate stops list preview */}
                              {stopsCount > 0 && isLineActive && (
                                <div style={{ fontSize: '0.74rem', color: 'var(--clr-ink-muted)', marginTop: 2, padding: '4px 8px', background: 'var(--clr-surface)', borderRadius: 8, border: '1px solid var(--clr-border)' }}>
                                  <strong>Stops Sequence:</strong> {l.intermediate_stops.map((s: any) => s.name).join(' ➔ ')}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action bar or Reviewed Status Banner */}
                {selected.status === 'approved' ? (
                  <div style={{
                    padding: '14px 16px', background: 'rgba(16, 185, 129, 0.1)',
                    borderTop: '1px solid #10B981', color: '#10B981',
                    fontWeight: 700, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <span>✅ Approved by Admin</span>
                    {selected.reviewed_at && (
                      <span style={{ fontSize: '0.78rem', color: 'var(--clr-ink-muted)', fontWeight: 500 }}>
                        · Station live on map ({new Date(selected.reviewed_at).toLocaleDateString()})
                      </span>
                    )}
                  </div>
                ) : selected.status === 'rejected' ? (
                  <div style={{
                    padding: '14px 16px', background: 'rgba(239, 68, 68, 0.1)',
                    borderTop: '1px solid #EF4444', color: '#EF4444',
                    fontWeight: 700, fontSize: '0.92rem', display: 'flex', flexDirection: 'column', gap: 4,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>✕ Rejected</span>
                      {selected.reviewed_at && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--clr-ink-muted)', fontWeight: 500 }}>
                          · {new Date(selected.reviewed_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {selected.reviewer_note && (
                      <div style={{ fontSize: '0.82rem', color: 'var(--clr-ink)', fontWeight: 500 }}>
                        Reason: "{selected.reviewer_note}"
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{
                    padding: '12px 16px', background: 'var(--clr-surface)',
                    borderTop: '1px solid var(--clr-border)',
                    display: 'flex', flexDirection: 'column', gap: 10,
                    position: 'sticky', bottom: 0,
                  }}>
                    <input
                      className="input"
                      placeholder={t('admin.rejectReason')}
                      value={rejectNote}
                      onChange={e => setRejectNote(e.target.value)}
                    />
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        className="btn btn-danger"
                        style={{ flex: 1 }}
                        onClick={() => reject(selected.id)}
                        disabled={!rejectNote.trim() || actionLoading}
                      >
                        {t('reject')}
                      </button>
                      <button
                        className="btn btn-primary"
                        style={{ flex: 2 }}
                        onClick={() => approve(selected.id)}
                        disabled={actionLoading}
                      >
                        {actionLoading ? '…' : `✓ ${t('approve')}`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Queue list */}
          {!loading && displayedItems.map(item => {
            const p = item.payload as Record<string, unknown>;
            const isReport = item.type === 'report' || (item.type === 'edit_station' && !p.lat);
            const category = String(p.category || 'general_comment');
            const stationName = String(p.station_name || p.name_am || p.name_en || 'Station');

            let icon = '🚐';
            let title = stationName;
            let subtitle = `${item.photo_paths.length} photos · ${timeAgo(item.created_at)}`;
            let tagColor = 'var(--clr-primary)';
            let tagBg = 'rgba(31, 79, 163, 0.12)';
            let tagText = 'New Station';

            if (isReport) {
              if (category === 'fare_change') {
                icon = '💰';
                title = `Fare: ${String(p.destination_name || 'Line')}`;
                subtitle = `${stationName} · ${p.current_fare ? p.current_fare + ' birr ➔ ' : ''}${p.suggested_fare} birr`;
                tagColor = '#10B981';
                tagBg = 'rgba(16, 185, 129, 0.12)';
                tagText = 'Fare Change';
              } else if (category === 'landmark') {
                icon = '📍';
                title = `Spot: ${stationName}`;
                subtitle = `"${String(p.suggested_landmark || p.comment || 'Update spot')}"`;
                tagColor = '#D97706';
                tagBg = 'rgba(245, 158, 11, 0.12)';
                tagText = 'Landmark';
              } else if (category === 'add_line') {
                icon = '🚌';
                title = `New Line: ${String(p.suggested_new_dest)}`;
                subtitle = `${stationName} · ${p.suggested_fare} birr`;
                tagColor = '#1F4FA3';
                tagBg = 'rgba(31, 79, 163, 0.12)';
                tagText = 'New Line';
              } else if (category === 'station_closed') {
                icon = '🚫';
                title = `Closed: ${stationName}`;
                subtitle = `Reported closed · ${timeAgo(item.created_at)}`;
                tagColor = '#DC2626';
                tagBg = 'rgba(239, 68, 68, 0.12)';
                tagText = 'Closed';
              } else {
                icon = '💬';
                title = `Comment: ${stationName}`;
                subtitle = p.comment ? `"${String(p.comment).slice(0, 45)}…"` : timeAgo(item.created_at);
                tagColor = '#4E5D7A';
                tagBg = 'rgba(78, 93, 122, 0.12)';
                tagText = 'Comment';
              }
            }

            return (
              <div
                key={item.id}
                className="queue-item"
                onClick={() => setSelectedId(item.id)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && setSelectedId(item.id)}
                style={{ cursor: 'pointer' }}
              >
                <div style={{ fontSize: '1.6rem', padding: '0 4px', display: 'flex', alignItems: 'center' }}>
                  {icon}
                </div>
                <div className="queue-item-main">
                  <div style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 100, fontSize: '0.72rem', fontWeight: 700,
                      color: tagColor, background: tagBg,
                    }}>
                      {tagText}
                    </span>
                    <span style={{
                      padding: '2px 8px', borderRadius: 100, fontSize: '0.72rem', fontWeight: 700,
                      color: item.status === 'approved' ? '#10B981' : item.status === 'rejected' ? '#EF4444' : '#F59E0B',
                      background: item.status === 'approved' ? 'rgba(16, 185, 129, 0.12)' : item.status === 'rejected' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                    }}>
                      {item.status === 'approved' ? '✓ Approved' : item.status === 'rejected' ? '✕ Rejected' : '🕒 Pending'}
                    </span>
                    <span className="text-xs text-muted">{timeAgo(item.created_at)}</span>
                  </div>
                  <div className="queue-item-name" style={{ fontSize: '0.96rem', fontWeight: 700 }}>
                    {title}
                  </div>
                  <div className="queue-item-meta" style={{ fontSize: '0.82rem', color: 'var(--clr-ink-muted)' }}>
                    {subtitle}
                  </div>
                </div>
                <span style={{ color: 'var(--clr-ink-muted)', fontSize: '1.2rem', paddingRight: 4 }}>›</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Tools tab */}
      {tab === 'tools' && (
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p className="text-sm text-muted">Admin tools: export data, batch manage stations.</p>
          <button className="btn btn-secondary btn-full" onClick={() => alert('Export coming soon')}>
            📁 Export CSV / GeoJSON
          </button>
        </div>
      )}
    </div>
  );
}
