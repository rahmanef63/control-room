'use client';

const CHUNK_RELOAD_GUARD_KEY = 'vps-control-room:chunk-reload-at';
const CHUNK_RELOAD_WINDOW_MS = 30_000;

function getErrorText(error: unknown) {
  if (error instanceof Error) {
    return `${error.name} ${error.message}`;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return '';
}

export function isChunkLoadError(error: unknown) {
  const text = getErrorText(error).toLowerCase();

  return (
    text.includes('/_next/static/') ||
    text.includes('chunkloaderror') ||
    text.includes('loading chunk') ||
    text.includes('loading css chunk') ||
    text.includes('failed to fetch dynamically imported module')
  );
}

export function reloadForChunkError() {
  if (typeof window === 'undefined') {
    return false;
  }

  const now = Date.now();
  const lastReloadAt = Number(window.sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY) ?? '0');

  if (Number.isFinite(lastReloadAt) && now - lastReloadAt < CHUNK_RELOAD_WINDOW_MS) {
    return false;
  }

  window.sessionStorage.setItem(CHUNK_RELOAD_GUARD_KEY, String(now));
  window.location.reload();
  return true;
}
