import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'Jarvis',
        short_name: 'Jarvis',
        description: 'Personal media & intelligence hub',
        theme_color: '#141414',
        background_color: '#141414',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Activate new SW immediately without waiting for app to be closed
        skipWaiting: true,
        clientsClaim: true,
        // Assets estáticos: cache-first (largo plazo)
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Llamadas a /api/news/*: stale-while-revalidate (contenido fresco pero rápido)
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/api\/news\//,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-news-cache',
              expiration: { maxAgeSeconds: 60 * 60 }, // 1h
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Imágenes externas (thumbnails de artículos)
          {
            urlPattern: /\.(png|jpg|jpeg|webp|gif|svg)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 }, // 7d
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
