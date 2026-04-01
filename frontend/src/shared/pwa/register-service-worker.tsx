'use client';

import { useEffect } from 'react';

export function RegisterServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Detect when a new SW version is found
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            // Only notify if there is an existing controller (not the first install)
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              window.dispatchEvent(new CustomEvent('sw:updateavailable'));
            }
          });
        });

        // Poll for updates every 60 minutes while the app is open
        const interval = setInterval(() => registration.update(), 60 * 60 * 1000);
        return () => clearInterval(interval);
      })
      .catch(() => {
        // Ignore registration errors — app still works without offline caching
      });
  }, []);

  return null;
}
