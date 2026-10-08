import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8789', ws: true },
      ...(process.env.API_PROXY_TARGET
        ? { '/_test': { target: process.env.API_PROXY_TARGET } }
        : {}),
    },
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: { three: ['three'], tabletop: ['@react-three/fiber', '@react-three/drei'] },
      },
    },
  },
});
