import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      transitionTimingFunction: {
        'md-standard':         'cubic-bezier(0.2, 0, 0, 1)',
        'md-standard-decel':   'cubic-bezier(0, 0, 0, 1)',
        'md-emphasized-decel': 'cubic-bezier(0.05, 0.7, 0.1, 1)',
      },
      transitionDuration: {
        'short2':  '100ms',
        'short4':  '200ms',
        'medium2': '300ms',
        'medium4': '400ms',
      },
      borderRadius: {
        'md-extra-small': '4px',
        'md-small':       '8px',
        'md-medium':      '12px',
        'md-large':       '16px',
        'md-extra-large': '28px',
        'md-full':        '9999px',
      },
    },
  },
  plugins: [],
} satisfies Config
