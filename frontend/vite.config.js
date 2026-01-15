import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const packageJson = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'GhassiCloud',
        short_name: 'GhassiCloud',
        description: 'Embrace Digital Sovereignty with GhassiCloud',
        theme_color: '#0891b2',
        background_color: '#0891b2',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'logos/logo-circle-cyan.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'logos/logo-circle-cyan.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'logos/logo-circle-cyan.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        skipWaiting: true,
        clientsClaim: true
      }
    })
  ],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(packageJson.version)
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  build: {
    // Increase the warning threshold so large but intentional chunks don't spam CI logs
    chunkSizeWarningLimit: 1000,
    // You can add manualChunks here later to improve chunking if needed
    // rollupOptions: {
    //   output: { manualChunks: { /* ... */ } }
    // }
  }
})
