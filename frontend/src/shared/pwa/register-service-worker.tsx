'use client';

import { useEffect } from 'react';

export function RegisterServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;
    let reloaded = false;
    const hadController = !!navigator.serviceWorker.controller;

    function autoSkipWaiting(reg: ServiceWorkerRegistration) {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
    }

    function onControllerChange() {
      if (reloaded || !hadController) return;
      reloaded = true;
      window.location.reload();
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        registration = reg;
        autoSkipWaiting(reg);
        void reg.update();
      })
      .catch(() => {});

    function onVisible() {
      if (document.visibilityState === 'visible' && registration) {
        void registration.update();
      }
    }
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return null;
}
