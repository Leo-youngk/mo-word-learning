import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | undefined;

updateServiceWorker = registerSW({
  immediate: true,
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent('mo:pwa-update-ready', {
      detail: {
        update: () => updateServiceWorker?.(true),
      },
    }));
  },
  onOfflineReady() {
    window.dispatchEvent(new CustomEvent('mo:pwa-offline-ready'));
  },
});
