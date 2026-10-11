import { useState, useEffect } from 'react';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('tt-theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('tt-theme', theme);
  }, [theme]);

  const toggle = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <button
      onClick={toggle}
      aria-label={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
      title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
      style={{
        background: 'var(--clr-soft)',
        border: '1.5px solid var(--clr-border)',
        borderRadius: '100px',
        padding: '4px 10px',
        fontFamily: 'inherit',
        fontSize: '0.9rem',
        cursor: 'pointer',
        minHeight: '32px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--clr-ink)',
      }}
    >
      {theme === 'light' ? '☀️' : '🌙'}
    </button>
  );
}
