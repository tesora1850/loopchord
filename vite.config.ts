import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/loopchord/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'favicon-32.png'],
      manifest: {
        name: '루프코드',
        short_name: '루프코드',
        description: '8마디 루프 기반 피아노 코드 연습 앱',
        start_url: '/loopchord/',
        scope: '/loopchord/',
        display: 'standalone',
        background_color: '#181a16',
        theme_color: '#7a2432',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  // Mojave 구형 맥북의 오래된 Safari(12/13)에서도 동작하도록 트랜스파일 타겟을 낮춘다.
  build: {
    target: ['safari13', 'ios13'],
  },
})
