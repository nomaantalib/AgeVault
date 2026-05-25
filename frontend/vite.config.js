import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@vladmandic/face-api')) {
              return 'face-api';
            }
            if (id.includes('tesseract.js')) {
              return 'tesseract';
            }
            if (id.includes('html5-qrcode')) {
              return 'html5-qrcode';
            }
            if (id.includes('lucide-react')) {
              return 'lucide-react';
            }
            return 'vendor';
          }
        }
      }
    }
  }
});

