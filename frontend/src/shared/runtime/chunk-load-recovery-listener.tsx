'use client';

import { useEffect } from 'react';

import {
  errorToText,
  isChunkLoadError,
  reloadForChunkError,
} from '@/shared/runtime/chunk-load-recovery';

/** Browser-extension messaging noise that originates outside our code (Grammarly,
 *  password managers, MetaMask etc.) and floods the console as
 *  "A listener indicated an asynchronous response by returning true, but the
 *  message channel closed before a response was received." Suppress so it does
 *  not drown real errors. */
const EXTENSION_NOISE_PATTERNS = [
  /A listener indicated an asynchronous response by returning true/i,
  /message channel closed before a response was received/i,
];

function isExtensionNoise(text: string) {
  return EXTENSION_NOISE_PATTERNS.some((p) => p.test(text));
}

export function ChunkLoadRecoveryListener() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const reason = event.error ?? event.message;
      const text = errorToText(reason) || event.message || '';
      if (isExtensionNoise(text)) {
        event.preventDefault();
        return;
      }
      if (isChunkLoadError(reason)) {
        reloadForChunkError();
      }
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const text = errorToText(event.reason);
      if (isExtensionNoise(text)) {
        event.preventDefault();
        return;
      }
      if (isChunkLoadError(event.reason)) {
        reloadForChunkError();
      }
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  return null;
}
