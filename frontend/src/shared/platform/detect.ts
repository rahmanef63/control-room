// Single source of truth for "which OS / how is this running / what can it do".
// Pure + SSR-safe: returns a neutral default on the server, real values in the
// browser. The per-OS design tokens (tokens.css) key off this.

export type OS = 'ios' | 'android' | 'windows' | 'macos' | 'linux' | 'unknown';

export type DisplayMode = 'browser' | 'standalone' | 'twa' | 'webview2' | 'tauri';

export interface Platform {
  os: OS;
  displayMode: DisplayMode;
  /** Installed / app-mode window with no browser chrome. */
  isStandalone: boolean;
  isTouch: boolean;
  isMobile: boolean;
  /** navigator.vibrate available (web haptics). */
  hasHaptics: boolean;
  /** Android — Material You dynamic color is a meaningful hint. */
  hasDynamicColor: boolean;
  prefersDark: boolean;
}

export const SERVER_DEFAULT: Platform = {
  os: 'unknown',
  displayMode: 'browser',
  isStandalone: false,
  isTouch: false,
  isMobile: false,
  hasHaptics: false,
  hasDynamicColor: false,
  prefersDark: true,
};

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

function detectOS(ua: string, maxTouchPoints: number): OS {
  // iPadOS 13+ reports a desktop Safari UA, so fall back to a touch+Mac check.
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  if (/macintosh|mac os x/i.test(ua) && maxTouchPoints > 1) return 'ios';
  if (/android/i.test(ua)) return 'android';
  if (/windows/i.test(ua)) return 'windows';
  if (/macintosh|mac os x/i.test(ua)) return 'macos';
  if (/linux/i.test(ua)) return 'linux';
  return 'unknown';
}

function detectDisplayMode(standalone: boolean, ua: string): DisplayMode {
  if (typeof window !== 'undefined' && '__TAURI__' in window) return 'tauri';
  // A Trusted Web Activity launches the PWA from an android-app:// referrer.
  if (typeof document !== 'undefined' && document.referrer.startsWith('android-app://')) {
    return 'twa';
  }
  if (standalone && /\bEdg\//.test(ua)) return 'webview2';
  return standalone ? 'standalone' : 'browser';
}

export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return SERVER_DEFAULT;
  }

  const ua = navigator.userAgent;
  const maxTouchPoints = navigator.maxTouchPoints ?? 0;
  const os = detectOS(ua, maxTouchPoints);

  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    window.matchMedia?.('(display-mode: minimal-ui)').matches === true ||
    (navigator as NavigatorWithStandalone).standalone === true;

  return {
    os,
    displayMode: detectDisplayMode(standalone, ua),
    isStandalone: standalone,
    isTouch: maxTouchPoints > 0,
    isMobile: os === 'ios' || os === 'android',
    hasHaptics: typeof navigator.vibrate === 'function',
    hasDynamicColor: os === 'android',
    prefersDark: window.matchMedia?.('(prefers-color-scheme: dark)').matches !== false,
  };
}
