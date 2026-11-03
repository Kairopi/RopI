/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ROPI PRECISION MONOCHROME SYSTEM
        paper: '#FFFFFF',
        mist: '#F7F8FA',
        ink: '#111318',
        slate: '#666B75',
        line: '#E4E7EC',
        ultramarine: '#3452E8',
        
        // Semantic colors (used sparingly)
        success: {
          DEFAULT: '#10B981',
          light: '#D1FAE5',
        },
        warning: {
          DEFAULT: '#F59E0B',
          light: '#FEF3C7',
        },
        error: {
          DEFAULT: '#EF4444',
          light: '#FEE2E2',
        },
      },
      fontFamily: {
        sans: ['Geist Sans', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Geist Mono', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
      },
      fontSize: {
        // Precise typography scale
        'xs': ['12px', { lineHeight: '18px', letterSpacing: '0.02em' }],
        'sm': ['13px', { lineHeight: '18px', letterSpacing: '0.01em' }],
        'base': ['14px', { lineHeight: '22px' }],
        'md': ['15px', { lineHeight: '22px' }],
        'lg': ['16px', { lineHeight: '25px' }],
        'xl': ['21px', { lineHeight: '28px', letterSpacing: '-0.01em' }],
        '2xl': ['27px', { lineHeight: '30px', letterSpacing: '-0.02em' }],
        '3xl': ['38px', { lineHeight: '44px', letterSpacing: '-0.02em' }],
      },
      fontWeight: {
        normal: '400',
        medium: '500',
        semibold: '550',
        bold: '600',
      },
      borderRadius: {
        sm: '8px',
        md: '10px',
        lg: '12px',
      },
      spacing: {
        // 8px rhythm
        '1': '8px',
        '2': '16px',
        '3': '24px',
        '4': '32px',
        '5': '40px',
        '6': '48px',
        '8': '64px',
        '10': '80px',
      },
      boxShadow: {
        'subtle': '0 1px 2px rgba(17, 19, 24, 0.04)',
        'card': '0 2px 8px rgba(17, 19, 24, 0.06)',
        'elevated': '0 8px 24px rgba(17, 19, 24, 0.08)',
      },
    },
  },
  plugins: [],
}
