/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './content/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // KinForge - Dark background palette (don't override 'black' to preserve opacity modifiers)
        dark: {
          950: '#000000',
          900: '#0a0a0a',
          800: '#121212',
          700: '#1a1a1a',
          600: '#262626',
        },
        // Gold accent palette (primary)
        gold: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        // Silver/Grey palette (secondary)
        silver: {
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
        },
        // Kin House colors - DNA Theme
        'kin-alpha': '#FFD700',    // 金色 - Alpha
        'kin-beta': '#C0C0C0',     // 银色 - Beta
        'kin-gamma': '#E5B80B',    // 琥珀 - Gamma
        'kin-delta': '#CD7F32',    // 青铜 - Delta
        'kin-epsilon': '#B8860B',  // 暗金 - Epsilon
        'kin-zeta': '#DAA520',     // 金菊 - Zeta
        'kin-omega': '#8B4513',    // 鞍褐 - Omega
        // Legacy navy colors (for backwards compatibility)
        navy: {
          950: '#0a0a0a',
          900: '#0a0a0a',
          800: '#121212',
          700: '#1a1a1a',
          600: '#262626',
          500: '#333333',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'kin-gradient': 'linear-gradient(180deg, #000000 0%, #121212 50%, #0a0a0a 100%)',
        'glass-gold': 'linear-gradient(135deg, rgba(251, 191, 36, 0.05) 0%, rgba(0, 0, 0, 0.8) 100%)',
        'gold-shimmer': 'linear-gradient(90deg, #FFD700, #FFA500, #FF8C00, #FFA500, #FFD700)',
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(251, 191, 36, 0.1)',
        'glow-gold': '0 0 40px rgba(251, 191, 36, 0.4)',
        'glow-gold-soft': '0 0 60px rgba(251, 191, 36, 0.2)',
      },
      fontFamily: {
        sans: ['Inter', 'PingFang SC', 'Microsoft YaHei', 'system-ui', 'sans-serif'],
        display: ['Inter', 'PingFang SC', 'Microsoft YaHei', 'system-ui', 'sans-serif'],
      },
      animation: {
        'gold-shimmer': 'gold-shimmer 3s linear infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'dna-rotate': 'dna-rotate 10s linear infinite',
      },
      keyframes: {
        'gold-shimmer': {
          'to': { backgroundPosition: '200% center' },
        },
        'pulse-glow': {
          '0%, 100%': {
            opacity: '1',
            boxShadow: '0 0 20px rgba(251, 191, 36, 0.3)',
          },
          '50%': {
            opacity: '0.8',
            boxShadow: '0 0 40px rgba(251, 191, 36, 0.5)',
          },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'dna-rotate': {
          '0%': { transform: 'rotateY(0deg)' },
          '100%': { transform: 'rotateY(360deg)' },
        },
      },
      typography: {
        DEFAULT: {
          css: {
            color: '#e5e7eb',
            a: { color: '#fbbf24' },
            h1: { color: '#ffffff' },
            h2: { color: '#f9fafb' },
            h3: { color: '#f3f4f6' },
            h4: { color: '#e5e7eb' },
            strong: { color: '#ffffff' },
            code: { color: '#fbbf24' },
            blockquote: { color: '#9ca3af', borderLeftColor: '#fbbf24' },
          },
        },
      },
    },
  },
  plugins: [],
};
