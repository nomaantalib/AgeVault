/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#030712',
          800: '#111827',
          700: '#1f2937',
          600: '#374151'
        },
        brand: {
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          glow: 'rgba(99, 102, 241, 0.15)'
        },
        amber: {
          300: '#ffe57f',
          400: '#ffd700',
          500: '#d4af37',
          600: '#b8860b',
          700: '#aa7c11',
          800: '#8a6f3e',
        },
        orange: {
          300: '#ffd700',
          400: '#aa7c11',
          500: '#000000',
          600: '#050403',
          700: '#0a0907',
          800: '#0f0e0b',
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        'glow-primary': '0 0 20px 5px rgba(99, 102, 241, 0.25)',
        'glow-success': '0 0 20px 5px rgba(16, 185, 129, 0.25)',
        'glow-error': '0 0 20px 5px rgba(239, 68, 68, 0.25)',
      }
    },
  },
  plugins: [],
}
