import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#0f172a',
        surfaceHighlight: '#1e293b',
      },
    },
  },
  plugins: [],
};

export default config;
