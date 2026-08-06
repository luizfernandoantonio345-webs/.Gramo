import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './design-system/tokens.css';
import { App } from './App';

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
