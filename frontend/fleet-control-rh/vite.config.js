import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: 'autoUpdate',

      manifest: {
        name: 'FleetControlRH',
        short_name: 'FleetRH',

        description:
          'Controle de abastecimentos e gestão de frota',

        theme_color: '#0d6efd',
        background_color: '#ffffff',

        display: 'standalone',

        start_url: '/',

        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },

          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
})