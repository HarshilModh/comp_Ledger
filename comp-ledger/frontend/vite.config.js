import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4001',
        changeOrigin: true,
        ws: false,
        // Required for SSE: disable proxy buffering so events stream through immediately
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            if (proxyRes.headers['content-type']?.includes('text/event-stream')) {
              proxyRes.headers['x-accel-buffering'] = 'no';
              proxyRes.headers['cache-control'] = 'no-cache';
            }
          });
        },
      },
      '/swagger-ui': {
        target: 'http://localhost:4001',
        changeOrigin: true,
      },
      '/api-docs': {
        target: 'http://localhost:4001',
        changeOrigin: true,
      },
      '/v3/api-docs': {
        target: 'http://localhost:4001',
        changeOrigin: true,
      },
    },
  },
  appType: 'spa',
});
