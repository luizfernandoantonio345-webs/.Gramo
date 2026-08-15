import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Fontes self-hosted (empacotadas no build) -- PWA funciona offline, sem
// depender do Google Fonts. Inter (variavel) para a UI; IBM Plex Mono p/ numeros.
import '@fontsource-variable/inter';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import './design-system/tokens.css';
import './design-system/ui.css';
import { App } from './App';
import { bloquearZoomPincaIOS } from './lib/no-zoom-ios';

// Cara de app: no iPhone, mata o zoom por pinca (o CSS ja cuida do toque duplo).
bloquearZoomPincaIOS();

// Auto-atualizacao: quando um novo service worker assume o controle (deploy de
// versao nova), recarrega a pagina automaticamente -- o usuario nunca fica preso
// numa versao antiga em cache. O guard evita loop de reload.
if ('serviceWorker' in navigator) {
  let recarregando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recarregando) return;
    recarregando = true;
    window.location.reload();
  });
}

const container = document.getElementById('root');
if (!container) throw new Error('Elemento #root nao encontrado');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
