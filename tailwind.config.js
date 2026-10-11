/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        primary:  { DEFAULT: '#1F4FA3', dark: '#4B7FD4' },
        accent:   { DEFAULT: '#F2B705', dark: '#F5C842' },
        ink:      { DEFAULT: '#14213D', dark: '#E8EDF5' },
        soft:     { DEFAULT: '#EAF0FB', dark: '#1A2440' },
        success:  { DEFAULT: '#1F7A4D', dark: '#34C47A' },
        danger:   { DEFAULT: '#B3261E', dark: '#E06C6C' },
      },
      borderRadius: { DEFAULT: '12px', sm: '8px', lg: '16px', full: '9999px' },
      fontFamily: {
        sans: ['Figtree', 'Noto Sans Ethiopic', 'system-ui', 'sans-serif'],
      },
      minHeight: { touch: '44px' },
      minWidth:  { touch: '44px' },
    },
  },
  plugins: [],
};
