import { Map, Route, Bookmark, PlusCircle, User } from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: 'map' | 'planner' | 'saved' | 'contribute' | 'profile';
  onSelectTab: (tab: 'map' | 'planner' | 'saved' | 'contribute' | 'profile') => void;
  lang: string;
}

export function MobileBottomNav({ activeTab, onSelectTab, lang }: MobileBottomNavProps) {
  const tabs = [
    { id: 'map' as const, label: lang === 'am' ? 'ካርታ' : 'Map', icon: Map },
    { id: 'planner' as const, label: lang === 'am' ? 'እቅድ' : 'Plan', icon: Route },
    { id: 'saved' as const, label: lang === 'am' ? 'ቅርብ' : 'Nearby', icon: Bookmark },
    { id: 'contribute' as const, label: lang === 'am' ? 'አክል' : 'Add', icon: PlusCircle },
    { id: 'profile' as const, label: lang === 'am' ? 'መለያ' : 'Profile', icon: User },
  ];

  return (
    <nav
      className="mobile-bottom-nav"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'calc(62px + env(safe-area-inset-bottom, 0px))',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        background: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 1000,
        boxShadow: '0 -4px 18px rgba(20, 33, 61, 0.08)',
      }}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            style={{
              flex: 1,
              height: '100%',
              background: 'none',
              border: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              cursor: 'pointer',
              color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
              transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
              position: 'relative',
              padding: '6px 0',
            }}
          >
            {isActive && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  width: 32,
                  height: 3,
                  background: 'linear-gradient(90deg, #6554F0, #805CFF)',
                  borderRadius: '0 0 3px 3px',
                }}
              />
            )}
            <div
              style={{
                transform: isActive ? 'scale(1.1) translateY(-1px)' : 'scale(1)',
                transition: 'transform 0.18s ease',
              }}
            >
              <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} />
            </div>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: isActive ? 700 : 500,
                letterSpacing: '0.02em',
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
