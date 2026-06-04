/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
      },
      colors: {
        energy: {
          yellow: '#FDE047',
          amber: '#F59E0B',
          blue: '#3B82F6',
          electric: '#38BDF8',
          green: '#22C55E',
          neon: '#4ADE80',
          orange: '#F97316',
          red: '#EF4444',
          dark: '#030712',
          darker: '#02040A',
          card: 'rgba(255,255,255,0.04)',
          border: 'rgba(255,255,255,0.08)',
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'glass': 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
        'mesh-dark': 'radial-gradient(at 40% 20%, rgba(59, 130, 246, 0.12) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(139, 92, 246, 0.12) 0px, transparent 50%), radial-gradient(at 0% 50%, rgba(245, 158, 11, 0.08) 0px, transparent 50%)',
      },
      boxShadow: {
        'glow-blue': '0 0 30px rgba(59, 130, 246, 0.4)',
        'glow-amber': '0 0 30px rgba(245, 158, 11, 0.4)',
        'glow-green': '0 0 30px rgba(34, 197, 94, 0.4)',
        'glass': '0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
        'card': '0 10px 40px -10px rgba(0, 0, 0, 0.5)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in': 'slideIn 0.3s ease-out',
        'fade-in': 'fadeIn 0.25s ease-out',
        'float': 'float 8s ease-in-out infinite',
        'float-delayed': 'float 8s ease-in-out 2s infinite',
        'float-slow': 'float 12s ease-in-out 4s infinite',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
        'shimmer': 'shimmer 2.5s linear infinite',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateY(-12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'scale(0.98)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg) scale(1)' },
          '33%': { transform: 'translateY(-20px) rotate(3deg) scale(1.02)' },
          '66%': { transform: 'translateY(-10px) rotate(-2deg) scale(0.98)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.5', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.08)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        }
      },
      backdropBlur: {
        xs: '2px',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      }
    },
  },
  plugins: [],
}
