import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Spinner, Tag } from '../components/ui/index';
import type { Submission } from '../types';

interface SubmissionWithMeta extends Submission {
  station_name?: string;
}

export default function MePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<SubmissionWithMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('submissions')
      .select('*')
      .eq('submitter_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setItems(data ?? []);
        setLoading(false);
      });
  }, [user]);

  const counts = {
    approved: items.filter(i => i.status === 'approved').length,
    pending: items.filter(i => i.status === 'pending').length,
    rejected: items.filter(i => i.status === 'rejected').length,
  };

  if (authLoading || loading) {
    return <div className="flex-center" style={{ height: '100%' }}><Spinner /></div>;
  }

  return (
    <div className="me-page">
      {/* Header */}
      <div className="app-header">
        <button className="btn btn-ghost" style={{ minWidth: 44, padding: '0 8px' }} onClick={() => navigate('/')}>
          ←
        </button>
        <span className="app-header-title">{t('myContributions')}</span>
      </div>

      {/* Stats */}
      <div className="me-stats">
        <div className="me-stat">
          <div className="me-stat-num" style={{ color: 'var(--clr-success)' }}>{counts.approved}</div>
          <div className="me-stat-label">{t('approved')}</div>
        </div>
        <div className="me-stat">
          <div className="me-stat-num" style={{ color: 'var(--clr-primary)' }}>{counts.pending}</div>
          <div className="me-stat-label">{t('pending')}</div>
        </div>
        <div className="me-stat">
          <div className="me-stat-num" style={{ color: 'var(--clr-danger)' }}>{counts.rejected}</div>
          <div className="me-stat-label">{t('rejected')}</div>
        </div>
      </div>

      {/* List */}
      {items.length === 0 ? (
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🤝</div>
          <h2 style={{ marginBottom: 8 }}>Be the first to contribute!</h2>
          <p className="text-sm text-muted" style={{ marginBottom: 20 }}>
            Help riders by adding taxi stations you know.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/add')}>
            {t('addStation')}
          </button>
        </div>
      ) : (
        <div>
          {items.map(item => (
            <div key={item.id} className="contribution-item">
              <div className="contribution-item-main">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Tag variant={item.type === 'new_station' ? 'new' : item.type === 'edit_station' ? 'edit' : 'report'}>
                    {item.type === 'new_station' ? 'New' : item.type === 'edit_station' ? 'Edit' : 'Report'}
                  </Tag>
                  <Tag variant={item.status as 'pending' | 'approved' | 'rejected'}>
                    {t(`status${item.status.charAt(0).toUpperCase() + item.status.slice(1)}` as 'statusPending')}
                  </Tag>
                </div>
                <div className="contribution-name">
                  {(item.payload as { name_en?: string; name_am?: string }).name_en
                    || (item.payload as { name_am?: string }).name_am
                    || 'Station'}
                </div>
                <div className="contribution-meta">
                  {new Date(item.created_at).toLocaleDateString()}
                </div>
                {item.status === 'rejected' && item.reviewer_note && (
                  <div className="contribution-note">
                    Reason: {item.reviewer_note}
                  </div>
                )}
              </div>

              {item.status === 'pending' && (
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: '0.8rem', color: 'var(--clr-danger)', padding: '4px 8px', minHeight: 32 }}
                  onClick={async () => {
                    await supabase.from('submissions').delete().eq('id', item.id);
                    setItems(prev => prev.filter(i => i.id !== item.id));
                  }}
                >
                  Withdraw
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
