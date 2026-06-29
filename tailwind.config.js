/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0A0506',
        surface: '#1A0E10',
        border: '#3A1C22',
        accent: '#E11D2A',
        'accent-deep': '#8B0E16',
        gold: '#C9A227',
        win: '#10B981',
        neutral: '#9A7A7E',
        txt: '#F8F4F4',
        sub: '#C39AA0',
        movie: '#E11D2A',
        tv: '#C9A227',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 44px -8px rgba(225,29,42,0.65)',
        card: '0 8px 24px -8px rgba(0,0,0,0.7)',
      },
    },
  },
  plugins: [],
};
