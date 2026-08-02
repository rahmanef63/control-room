'use client';

import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const standaloneMql = window.matchMedia('(display-mode: standalone)');
    const minimalMql = window.matchMedia('(display-mode: minimal-ui)');
    const checkInstalled = () => {
      const isStandalone =
        standaloneMql.matches ||
        minimalMql.matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (isStandalone) {
        setInstalled(true);
        setDeferredPrompt(null);
      } else {
        setInstalled(false);
      }
    };

    checkInstalled();
    standaloneMql.addEventListener('change', checkInstalled);
    minimalMql.addEventListener('change', checkInstalled);

    const handlePrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      standaloneMql.removeEventListener('change', checkInstalled);
      minimalMql.removeEventListener('change', checkInstalled);
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  // Stable ref (changes only when the deferred prompt does) so consumers can
  // pass it into memoized children without re-rendering them every render.
  const install = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  return {
    canInstall: !!deferredPrompt && !installed,
    installed,
    install,
  };
}
