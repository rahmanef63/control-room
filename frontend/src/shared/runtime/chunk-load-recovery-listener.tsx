'use client';

import { useEffect } from 'react';

import { isChunkLoadError, reloadForChunkError } from '@/shared/runtime/chunk-load-recovery';

export function ChunkLoadRecoveryListener() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (isChunkLoadError(event.error ?? event.message)) {
        reloadForChunkError();
      }
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
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
