interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
}

export function BrandLogo({ size = 'md', showSubtitle = true }: BrandLogoProps) {
  const iconSize = size === 'sm' ? 26 : size === 'lg' ? 42 : 32;
  const amharicSize = size === 'sm' ? '1.05rem' : size === 'lg' ? '1.45rem' : '1.2rem';
  const englishSize = size === 'sm' ? '0.65rem' : size === 'lg' ? '0.78rem' : '0.72rem';

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: size === 'sm' ? 8 : 10, userSelect: 'none' }}>
      {/* Dynamic Animated Minibus + Spatial Pin Logo */}
      <div
        style={{
          width: iconSize,
          height: iconSize,
          borderRadius: size === 'sm' ? 8 : 10,
          background: 'linear-gradient(135deg, #6554F0 0%, #805CFF 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(101, 84, 240, 0.35)',
          position: 'relative',
          flexShrink: 0,
          transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <svg
          width={iconSize * 0.65}
          height={iconSize * 0.65}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 16c0 .88.39 1.67 1 2.22V20a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1h8v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10Z" />
          <circle cx="7.5" cy="14.5" r="1.5" fill="#F2B705" />
          <circle cx="16.5" cy="14.5" r="1.5" fill="#F2B705" />
          <line x1="4" y1="9" x2="20" y2="9" />
        </svg>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
        <span
          style={{
            fontFamily: "'Noto Sans Ethiopic', 'Inter', sans-serif",
            fontWeight: 800,
            fontSize: amharicSize,
            color: 'var(--color-brand)',
            letterSpacing: '0.01em',
          }}
        >
          ታክሲ ተራ
        </span>
        {showSubtitle && (
          <span
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 700,
              fontSize: englishSize,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--color-primary)',
              marginTop: 1,
            }}
          >
            TAXI TERA
          </span>
        )}
      </div>
    </div>
  );
}
