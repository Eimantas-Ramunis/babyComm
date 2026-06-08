import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Custom service worker so we can handle push + notificationclick events.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: {
        // App is small; allow precaching the JS bundle comfortably.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      // Serve + register the service worker during `npm run dev` too, so push subscription
      // (which needs an active SW) can be tested locally without a production build.
      devOptions: {
        enabled: true,
        type: 'module',
      },
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Tiny Bean Updates',
        short_name: 'Tiny Bean',
        start_url: '/',
        display: 'standalone',
        background_color: '#fff7ed',
        theme_color: '#f97316',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      // Forward API calls and generated card images to the Express backend during development.
      '/api': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000',
    },
  },
});
