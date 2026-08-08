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
      // PWA_OFF=true -> gera um service worker "auto-destrutivo" que remove o SW
      // antigo e limpa TODOS os caches no cliente (util em dev p/ desencalhar quem
      // ficou com versao velha). Em producao (sem a env) o PWA fica normal.
      selfDestroying: process.env.PWA_OFF === 'true',
      // Pre-cacheia tambem as fontes self-hosted (woff2) -- o padrao nao as
      // inclui. Sem isto, o PWA offline cairia no system-ui.
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
      },
      manifest: {
        name: '.GRAMO - Ponto Eletronico',
        short_name: '.GRAMO',
        description: 'Registro de ponto por reconhecimento facial e geolocalizacao',
        theme_color: '#ffffff',
        background_color: '#f6f7f9',
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
