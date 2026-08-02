'use client';

import { claimAutoReloadOnce, forceFreshReload } from '@/shared/runtime/force-fresh-reload';

/** Best-effort extraction of a searchable string from an unknown thrown value.
 *  Shared by isChunkLoadError here and the global error/rejection listener so the
 *  extraction logic lives in exactly one place. */
export function errorToText(error: unknown) {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}\n${error.stack ?? ''}`;
  }
  if (typeof error === 'string') return error;
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }
  return '';
}

const STALE_PATTERNS = [
  /chunkloaderror/i,
  /loading chunk \S+ failed/i,
  /loading css chunk \S+ failed/i,
  /failed to fetch dynamically imported module/i,
  /\/_next\/static\//i,
];

export function isChunkLoadError(error: unknown) {
  const text = errorToText(error);
  if (!text) return false;
  return STALE_PATTERNS.some((p) => p.test(text));
}

/** Auto-recover from a chunk-load failure: purge SW + caches + reload with
 *  cache-buster. Once-per-session guard prevents reload loops if the new
 *  bundle is also broken. */
export function reloadForChunkError() {
  if (typeof window === 'undefined') return false;
  if (!claimAutoReloadOnce()) return false;
  void forceFreshReload();
  return true;
}
