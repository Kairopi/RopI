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
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['Menlo', 'Monaco', 'Courier New', 'monospace'],
      },
      fontSize: {
        // Mobile-first responsive typography
        'xs': ['0.75rem', { lineHeight: '1.125rem', letterSpacing: '0.02em' }],    // 12px/18px
        'sm': ['0.8125rem', { lineHeight: '1.125rem', letterSpacing: '0.01em' }],  // 13px/18px
        'base': ['0.875rem', { lineHeight: '1.375rem' }],                          // 14px/22px
        'md': ['0.9375rem', { lineHeight: '1.375rem' }],                           // 15px/22px
        'lg': ['1rem', { lineHeight: '1.5625rem' }],                               // 16px/25px
        'xl': ['1.3125rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em' }], // 21px/28px
        '2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.02em' }],      // 24px/32px (mobile)
        '3xl': ['2rem', { lineHeight: '2.5rem', letterSpacing: '-0.02em' }],      // 32px/40px (mobile)
      },
      fontWeight: {
        normal: '400',
        medium: '500',
        semibold: '550',
        bold: '600',
      },
      borderRadius: {
        sm: '0.5rem',    // 8px
        md: '0.625rem',  // 10px
        lg: '0.75rem',   // 12px
      },
      spacing: {
        // Fluid 8px rhythm (scales down on mobile)
        '1': 'clamp(0.375rem, 2vw, 0.5rem)',     // 6-8px
        '2': 'clamp(0.75rem, 3vw, 1rem)',        // 12-16px
        '3': 'clamp(1.125rem, 4vw, 1.5rem)',     // 18-24px
        '4': 'clamp(1.5rem, 5vw, 2rem)',         // 24-32px
        '5': 'clamp(2rem, 6vw, 2.5rem)',         // 32-40px
        '6': 'clamp(2.5rem, 7vw, 3rem)',         // 40-48px
        '8': 'clamp(3rem, 9vw, 4rem)',           // 48-64px
        '10': 'clamp(4rem, 11vw, 5rem)',         // 64-80px
      },
      boxShadow: {
        'subtle': '0 1px 2px rgba(17, 19, 24, 0.04)',
        'card': '0 2px 8px rgba(17, 19, 24, 0.06)',
        'elevated': '0 8px 24px rgba(17, 19, 24, 0.08)',
      },
      screens: {
        'xs': '375px',   // Small phones
        'sm': '640px',   // Large phones
        'md': '768px',   // Tablets
        'lg': '1024px',  // Desktop
        'xl': '1280px',  // Large desktop
        '2xl': '1536px', // Extra large
      },
    },
  },
  plugins: [],
}
