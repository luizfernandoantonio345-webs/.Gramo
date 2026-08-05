import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// PWA instalavel + service worker. autoUpdate mantem o app atualizado; a fila
// offline de marcacoes (IndexedDB/Dexie) e implementada na Fase 2.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'REP-P - Ponto Eletronico',
        short_name: 'REP-P',
        description: 'Registro de ponto por reconhecimento facial e geolocalizacao',
        theme_color: '#14213D',
        background_color: '#F5F7FA',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      // Monorepo: importa o source TS do shared (esbuild compila direto),
      // evitando problemas de interop CJS no bundle de producao.
      '@repp/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true, // escuta em 0.0.0.0 (acesso via IP da LAN e port-forwarding)
    // Libera hosts externos (ex.: *.devtunnels.ms do "PORTS" do VS Code, IP da LAN).
    allowedHosts: true,
    // Proxy: o PWA chama /api no MESMO host (o link compartilhado) e o Vite
    // encaminha para a API local. Assim basta compartilhar UMA porta (5173).
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  // `vite preview` (serve o build de producao) usa a config propria -- espelha o
  // proxy do dev para o app buildado tambem falar com a API local numa porta so.
  preview: {
    port: 5173,
    host: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
