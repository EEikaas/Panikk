import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const target = process.env.VITE_SERVER_URL ?? 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // tilgjengelig fra mobiler på samme nettverk
    port: 5173,
    proxy: {
      '/api': { target, changeOrigin: false },
      '/socket.io': { target, ws: true, changeOrigin: false },
    },
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
        },
      },
    },
  },
});
