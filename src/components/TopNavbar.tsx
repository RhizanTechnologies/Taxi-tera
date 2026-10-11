import { useState, useRef, useEffect } from 'react';
import { Search, MapPin, Route, Plus, User, Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BrandLogo } from './BrandLogo';
import { pickName, matchesStationBilingualSearch } from '../lib/utils';
import type { Station, Line, Profile } from '../types';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface TopNavbarProps {
  stations: Station[];
  lines: Line[];
  lang: string;
  onSelectStation: (station: Station) => void;
  onOpenPlanner: () => void;
  onOpenAdd: () => void;
  user: SupabaseUser | null;
  profile: Profile | null;
  onOpenProfile: () => void;
  locationName?: string;
  onOpenLocationPicker?: () => void;
}

export function TopNavbar({
  stations,
  lines,
  lang,
  onSelectStation,
  onOpenPlanner,
  onOpenAdd,
  user,
  profile,
  onOpenProfile,
  locationName,
  onOpenLocationPicker,
}: TopNavbarProps) {
  const { i18n } = useTranslation();
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('tt-theme') as 'light' | 'dark') || 'light';
  });

  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Close search suggestions on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'am' ? 'en' : 'am';
    i18n.changeLanguage(nextLang);
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('tt-theme', nextTheme);
  };

  // Comprehensive bilingual & phonetic autocomplete matching:
  // English words match English names, Amharic names, and phonetic transliterations
  const matches = query.trim().length > 0
    ? stations
        .map((st) => {
          const matchResult = matchesStationBilingualSearch(st, query, lines);
          if (!matchResult.matched) return null;

          const lineMatches = matchResult.matchedLine ? [matchResult.matchedLine] : [];

          return {
            station: st,
            score: matchResult.score,
            matchedDestinations: lineMatches,
            name: pickName(st.name_am, st.name_en, lang),
            altName: lang === 'am' ? st.name_en : st.name_am,
            landmark: pickName(st.landmark_am, st.landmark_en, lang),
          };
        })
        .filter(Boolean)
        .sort((a, b) => b!.score - a!.score)
        .slice(0, 8)
    : [];

  return (
    <header className="urban-top-navbar">
      {/* ── Left: Brand Identity ────────────────────────────── */}
      <div className="top-navbar-brand-wrap">
        <BrandLogo size="md" />
      </div>

      {/* ── Center: Search Omnibar ──────────────────────────── */}
      <div
        ref={searchContainerRef}
        style={{
          flex: '0 1 480px',
          position: 'relative',
          margin: '0 16px',
        }}
        className="top-navbar-search-wrap"
      >
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            background: isFocused ? 'var(--color-surface)' : 'var(--color-surface-secondary)',
            border: isFocused ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
            borderRadius: 12,
            padding: '0 14px',
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            boxShadow: isFocused ? '0 0 0 3px rgba(101, 84, 240, 0.15)' : 'none',
          }}
        >
          <Search size={18} color={isFocused ? 'var(--color-primary)' : 'var(--color-text-muted)'} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            placeholder={lang === 'am' ? 'ጣቢያ፣ መድረሻ ወይም የት እንደቆሙ ፈልጉ...' : 'Search stations, destinations, or landmarks...'}
            style={{
              width: '100%',
              padding: '10px 10px',
              border: 'none',
              background: 'transparent',
              fontSize: '0.9rem',
              color: 'var(--color-text)',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-text-muted)',
                fontSize: '14px',
                padding: '2px 6px',
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Autocomplete Dropdown */}
        {isFocused && matches.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 0,
              right: 0,
              background: 'var(--color-surface)',
              borderRadius: 14,
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-floating)',
              overflow: 'hidden',
              zIndex: 1100,
              animation: 'fadeInUp 0.18s ease-out',
            }}
          >
            {matches.map((item) => {
              if (!item) return null;
              return (
                <div
                  key={item.station.id}
                  onClick={() => {
                    onSelectStation(item.station);
                    setIsFocused(false);
                    setQuery('');
                  }}
                  style={{
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--color-border)',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-secondary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: 'var(--color-surface-highlight)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--color-primary)',
                      }}
                    >
                      <MapPin size={17} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--color-text)' }}>
                        {item.name}
                        {item.altName && item.altName !== item.name && (
                          <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', fontSize: '0.8rem', marginLeft: 6 }}>
                            ({item.altName})
                          </span>
                        )}
                      </div>
                      {item.landmark && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: 1 }}>
                          📍 {item.landmark}
                        </div>
                      )}
                      {item.matchedDestinations.length > 0 && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)', marginTop: 2 }}>
                          ➔ Goes to: {item.matchedDestinations.map((l) => pickName(l.destination_am, l.destination_en, lang)).join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Tap to view</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Right: Action Buttons & Preferences ─────────────── */}
      <div className="top-nav-actions-wrap">
        {/* Quick Location Badge */}
        {onOpenLocationPicker && (
          <button
            onClick={onOpenLocationPicker}
            className="top-nav-loc-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '7px 10px',
              borderRadius: 10,
              background: 'var(--color-surface-secondary)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
            title={lang === 'am' ? 'ያለህበትን ቦታ ቀይር' : 'Change Location'}
          >
            <MapPin size={15} color="var(--color-primary)" />
            <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {locationName || (lang === 'am' ? 'መገኛዬ' : 'My Location')}
            </span>
          </button>
        )}

        {/* Plan Trip Quick Trigger (Desktop Only - Mobile has Bottom Nav) */}
        <button
          onClick={onOpenPlanner}
          className="top-nav-plan-btn top-nav-desktop-only"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            borderRadius: 10,
            background: 'linear-gradient(135deg, #6554F0 0%, #805CFF 100%)',
            color: '#FFFFFF',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 3px 10px rgba(101, 84, 240, 0.25)',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          }}
        >
          <Route size={16} />
          <span>{lang === 'am' ? 'ጉዞ አቅድ' : 'Plan Trip'}</span>
        </button>

        {/* Add Station (Desktop Only - Mobile has Bottom Nav) */}
        <button
          onClick={onOpenAdd}
          className="top-nav-add-btn top-nav-desktop-only"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            borderRadius: 10,
            background: 'var(--color-surface-secondary)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <Plus size={16} color="var(--color-primary)" />
          <span>{lang === 'am' ? 'ጣቢያ ጨምር' : 'Add Station'}</span>
        </button>

        {/* Language Switch (Visible on all devices) */}
        <button
          onClick={toggleLanguage}
          title="Toggle Language (Amharic / English)"
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface-secondary)',
            color: 'var(--color-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            flexShrink: 0,
          }}
        >
          {lang === 'am' ? 'EN' : 'አማ'}
        </button>

        {/* Theme Toggle (Desktop Only) */}
        <button
          onClick={toggleTheme}
          className="top-nav-desktop-only"
          title="Toggle Dark/Light Mode"
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface-secondary)',
            color: 'var(--color-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} color="#F2B705" />}
        </button>

        {/* Profile / Account Action (Desktop Only - Mobile has Bottom Nav) */}
        <button
          onClick={onOpenProfile}
          className="top-nav-desktop-only"
          title={user ? (profile?.display_name || user.email || 'Profile') : 'Sign In'}
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            border: '1.5px solid var(--color-primary)',
            background: user ? 'var(--color-surface-highlight)' : 'var(--color-surface-secondary)',
            color: 'var(--color-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            overflow: 'hidden',
            fontWeight: 700,
            fontSize: '0.85rem',
          }}
        >
          {profile?.display_name ? (
            profile.display_name.charAt(0).toUpperCase()
          ) : (
            <User size={18} />
          )}
        </button>
      </div>
    </header>
  );
}
