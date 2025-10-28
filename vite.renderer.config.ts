import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig(async () => {
  // eslint-disable-next-line import/no-unresolved
  const react = (await import('@vitejs/plugin-react')).default;
  // eslint-disable-next-line import/no-unresolved
  const tailwindcss = (await import('@tailwindcss/vite')).default;

  return {
    plugins: [react(), tailwindcss()],
  };
});
