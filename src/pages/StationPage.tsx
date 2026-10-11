import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  MapPin,
  Share2,
  Footprints,
  Edit3,
  ShieldCheck,
  AlertCircle,
  MessageSquarePlus,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { pickName } from '../lib/utils';
import { Skeleton } from '../components/ui/index';
import { ReportModal, type ReportCategory } from '../components/ReportModal';
import { REAL_STATIONS, REAL_LINES } from '../data/realStationsData';
import type { Station, Line, StationPhoto } from '../types';

function isOld(date: string | null) {
  if (!date) return true;
  return Date.now() - new Date(date).getTime() > 90 * 24 * 60 * 60 * 1000;
}

export default function StationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const [station, setStation] = useState<Station | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [photos, setPhotos] = useState<StationPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportTargetLine, setReportTargetLine] = useState<Line | null>(null);
  const [reportCategory, setReportCategory] = useState<ReportCategory>('general_comment');

  useEffect(() => {
    if (!id) return;
    (async () => {
      const localSt = REAL_STATIONS.find(s => s.id === id);
      const localLines = REAL_LINES.filter(l => l.station_id === id);

      const [{ data: st }, { data: li }, { data: ph }] = await Promise.all([
        localSt ? Promise.resolve({ data: localSt }) : supabase.from('stations').select('*').eq('id', id).maybeSingle(),
        localLines.length > 0 ? Promise.resolve({ data: localLines }) : supabase.from('lines').select('*').eq('station_id', id).order('sort_order'),
        supabase.from('station_photos').select('*').eq('station_id', id),
      ]);
      const finalStation = localSt || st;
      if (!finalStation) { setNotFound(true); setLoading(false); return; }
      setStation(finalStation);
      setLines(localLines.length > 0 ? localLines : (li ?? []));
      setPhotos((ph ?? []).sort((a, _b) => (a.kind === 'wide' ? -1 : 1)));
      setLoading(false);
    })();
  }, [id]);

  const getPhotoUrl = (path: string) =>
    supabase.storage.from('station-photos').getPublicUrl(path).data.publicUrl;

  const handleWalkHere = () => {
    if (!station) return;
    navigate(`/?walkTo=${station.id}`);
  };

  const handleShare = async () => {
    if (!station) return;
    const name = pickName(station.name_am, station.name_en, lang);
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: name, url });
    } else {
      await navigator.clipboard.writeText(url);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 24, maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Skeleton height="240px" />
        <Skeleton height="32px" width="70%" />
        <Skeleton height="20px" width="45%" />
        <Skeleton height="180px" />
      </div>
    );
  }

  if (notFound || !station) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16, padding: 24, textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-surface-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)' }}>
          <AlertCircle size={32} />
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)' }}>Station not found</h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.88rem', maxWidth: 320 }}>
          This station may have been removed or the link is incorrect.
        </p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          Return to map
        </button>
      </div>
    );
  }

  const name = pickName(station.name_am, station.name_en, lang);
  const landmark = pickName(station.landmark_am, station.landmark_en, lang);
  const old = isOld(station.last_verified_at);

  return (
    <div className="station-page" style={{ maxWidth: 680, margin: '0 auto', background: 'var(--color-surface)', minHeight: '100vh', boxShadow: 'var(--shadow-floating)' }}>
      {/* Photo hero */}
      <div className="station-page-hero" style={{ position: 'relative', height: 260, background: '#102A43', overflow: 'hidden' }}>
        <img
          src={photos.length > 0 ? getPhotoUrl(photos[photoIdx].path) : '/images/addis_taxi_hub.jpg'}
          alt={`${name} photo`}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(16,42,67,0.7) 0%, rgba(16,42,67,0.15) 50%, rgba(16,42,67,0.4) 100%)' }} />

        <button
          className="station-page-back"
          onClick={() => {
            if (window.history.length > 2) {
              navigate(-1);
            } else {
              navigate('/');
            }
          }}
          aria-label="Back"
          style={{
            position: 'absolute', top: 16, left: 16,
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(16,42,67,0.85)', backdropFilter: 'blur(8px)',
            color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 10,
          }}
        >
          <ArrowLeft size={18} />
        </button>

        {/* Photo dots */}
        {photos.length > 1 && (
          <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6, zIndex: 10 }}>
            {photos.map((_, i) => (
              <button
                key={i}
                onClick={() => setPhotoIdx(i)}
                style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: i === photoIdx ? 'var(--color-accent)' : 'rgba(255,255,255,0.4)',
                  border: 'none', cursor: 'pointer', padding: 0,
                  transition: 'background 0.2s ease',
                }}
                aria-label={`Photo ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="station-page-body" style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Name & status */}
        <div>
          {station.status === 'closed' && (
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#C23B3B', background: '#FDECEC', padding: '3px 10px', borderRadius: 4, marginBottom: 8, display: 'inline-block', letterSpacing: '0.04em' }}>
              STATION CLOSED
            </span>
          )}
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text)', margin: 0, lineHeight: 1.25 }}>{name}</h1>
          {station.name_am && station.name_en && (
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.92rem', marginTop: 4, margin: 0 }}>
              {lang === 'am' ? station.name_en : station.name_am}
            </p>
          )}
        </div>

        {/* Stand here / Boarding guidance */}
        {landmark && (
          <div style={{ background: 'var(--color-surface-secondary)', borderRadius: 'var(--radius-card)', padding: '16px', border: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <MapPin size={15} color="var(--color-primary)" />
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('standHere')}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ fontSize: '0.75rem', padding: '3px 8px', minHeight: 24, color: 'var(--color-primary)' }}
                onClick={() => { setReportCategory('landmark'); setReportTargetLine(null); setReportOpen(true); }}
              >
                <Edit3 size={13} style={{ marginRight: 4 }} /> Suggest update
              </button>
            </div>
            <p style={{ fontSize: '0.92rem', color: 'var(--color-text)', margin: 0, lineHeight: 1.5 }}>{landmark}</p>
          </div>
        )}

        {/* Verified badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
          {old ? (
            <AlertCircle size={15} color="var(--color-text-muted)" />
          ) : (
            <ShieldCheck size={15} color="#18794E" />
          )}
          <span>
            {t('lastVerified')}:{' '}
            <strong style={{ color: 'var(--color-text-secondary)' }}>
              {station.last_verified_at ? new Date(station.last_verified_at).toLocaleDateString() : 'Never'}
            </strong>
            {old && station.last_verified_at && (
              <span style={{ color: '#A15C07', marginLeft: 6, fontWeight: 500 }}>· May be outdated</span>
            )}
          </span>
        </div>

        {/* Lines and Fares */}
        <div style={{ borderRadius: 'var(--radius-panel)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)' }}>
              Destinations & Fares ({lines.length})
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600 }}>
              Addis Ababa Standard
            </span>
          </div>

          <div style={{ padding: '0 18px', background: 'var(--color-surface)' }}>
            {lines.length === 0 ? (
              <p style={{ padding: '20px 0', fontSize: '0.88rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>No fare data recorded yet.</p>
            ) : (
              lines.map(l => (
                <div
                  key={l.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 0',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ flex: 1, paddingRight: 16 }}>
                    <div style={{ fontSize: '0.98rem', fontWeight: 600, color: 'var(--color-text)' }}>
                      {pickName(l.destination_am, l.destination_en, lang)}
                    </div>
                    {l.direction && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                        Via: {l.direction}
                      </div>
                    )}
                    {l.fare_checked_at && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                        Verified {new Date(l.fare_checked_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                      {l.fare_birr} birr
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ fontSize: '0.75rem', padding: '2px 8px', minHeight: 22, color: 'var(--color-primary)' }}
                      onClick={() => { setReportCategory('fare_change'); setReportTargetLine(l); setReportOpen(true); }}
                    >
                      <Edit3 size={12} style={{ marginRight: 3 }} /> Suggest change
                    </button>
                    {l.return_station_id && (
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: '0.72rem', padding: '2px 6px', color: 'var(--color-text-secondary)' }}
                        onClick={() => navigate(`/station/${l.return_station_id}`)}
                      >
                        {t('showReturnTrip')} →
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Primary action buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 4 }}>
          <button className="btn btn-primary" onClick={handleWalkHere} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Footprints size={17} /> {t('walkHere')}
          </button>
          <button className="btn btn-secondary" onClick={handleShare} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Share2 size={17} /> {t('share')}
          </button>
        </div>

        {/* Suggest Change or Report */}
        <button
          className="btn btn-secondary btn-full"
          style={{ borderStyle: 'dashed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          onClick={() => { setReportCategory('general_comment'); setReportTargetLine(null); setReportOpen(true); }}
        >
          <MessageSquarePlus size={16} /> Suggest Change / Comment on Station
        </button>
      </div>

      {/* Report Modal */}
      {station && (
        <ReportModal
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          station={station}
          lines={lines}
          targetLine={reportTargetLine}
          initialCategory={reportCategory}
        />
      )}
    </div>
  );
}
