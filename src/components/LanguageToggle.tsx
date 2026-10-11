import { useTranslation } from 'react-i18next';

export function LanguageToggle() {
  const { i18n } = useTranslation();
  const isAm = i18n.language === 'am';

  const toggle = () => i18n.changeLanguage(isAm ? 'en' : 'am');

  return (
    <button
      onClick={toggle}
      aria-label={isAm ? 'Switch to English' : 'ወደ አማርኛ ቀይር'}
      style={{
        background: 'var(--clr-soft)',
        border: '1.5px solid var(--clr-border)',
        borderRadius: '100px',
        padding: '4px 12px',
        fontFamily: 'inherit',
        fontSize: '0.82rem',
        fontWeight: 700,
        color: 'var(--clr-primary)',
        cursor: 'pointer',
        minHeight: '32px',
        whiteSpace: 'nowrap',
      }}
    >
      {isAm ? 'EN' : 'አማ'}
    </button>
  );
}
