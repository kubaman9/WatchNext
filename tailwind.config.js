/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#09090E',
        surface: '#13131A',
        border: '#222230',
        accent: '#6D28D9',
        win: '#10B981',
        neutral: '#6B7280',
        txt: '#F9FAFB',
        sub: '#9CA3AF',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 40px -8px rgba(109,40,217,0.6)',
        card: '0 8px 24px -8px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
};
