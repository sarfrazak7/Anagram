/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Cinzel', 'serif'],
        body: ['Inter', 'sans-serif'],
        btn: ['"Black Ops One"', 'sans-serif'],
      },
      colors: {
        casino: {
          gold: '#D4AF37',
          'gold-light': '#F4D03F',
          'gold-dark': '#B7950B',
          felt: '#0a3d2e',
          'felt-dark': '#062518',
          'felt-light': '#1a6b4f',
          ink: '#1a1a2e',
          'ink-dark': '#0f0f1a',
          accent: '#e63946',
        },
      },
      animation: {
        'slide-up': 'slideUp 0.4s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'coin-flip': 'coinFlip 0.6s ease-out',
        'shake': 'shake 0.4s ease-in-out',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(212,175,55,0.4), 0 0 20px rgba(212,175,55,0.2)' },
          '50%': { boxShadow: '0 0 20px rgba(212,175,55,0.8), 0 0 40px rgba(212,175,55,0.4)' },
        },
        coinFlip: {
          '0%': { transform: 'rotateY(0deg) scale(0.8)', opacity: '0' },
          '50%': { transform: 'rotateY(180deg) scale(1.1)', opacity: '1' },
          '100%': { transform: 'rotateY(360deg) scale(1)', opacity: '1' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-8px)' },
          '75%': { transform: 'translateX(8px)' },
        },
      },
    },
  },
  plugins: [],
};
