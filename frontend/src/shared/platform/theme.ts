// Light / dark / system theme switching. The base palette already defines BOTH a
// light `:root` and a `.dark` override (frontend/app/styles/base.css), so theming
// is a class toggle, not a repaint. Default is `dark` — identical to the app's
// previous hardcoded behavior — until the user opts into light/system.

export type ThemeChoice = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'vps-cr-theme';

export function getStoredTheme(): ThemeChoice {
  if (typeof localStorage === 'undefined') return 'dark';
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'light' || v === 'system' || v === 'dark' ? v : 'dark';
}

export function storeTheme(choice: ThemeChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    /* storage blocked (private mode) — keep the in-memory choice only */
  }
}

export function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  if (choice === 'system') {
    return typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';
  }
  return choice;
}

export function applyTheme(choice: ThemeChoice): ResolvedTheme {
  const resolved = resolveTheme(choice);
  const el = document.documentElement;
  el.classList.toggle('dark', resolved === 'dark');
  el.style.colorScheme = resolved;
  return resolved;
}

// Optional per-OS skin: when on, the dashboard adopts this platform's font and
// corner radius (see tokens.css `[data-os-skin='on']`). Off by default — zero
// visual change until the user opts in from Settings → Appearance.
const OS_SKIN_KEY = 'vps-cr-os-skin';

export function getStoredOsSkin(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(OS_SKIN_KEY) === 'on';
}

export function storeOsSkin(on: boolean): void {
  try {
    localStorage.setItem(OS_SKIN_KEY, on ? 'on' : 'off');
  } catch {
    /* storage blocked */
  }
}

export function applyOsSkin(on: boolean): void {
  document.documentElement.dataset.osSkin = on ? 'on' : 'off';
}

// Runs in <head> BEFORE first paint to set the theme class with no flash (the
// same technique next-themes uses). Defaults to dark and is self-healing on error.
export const EARLY_THEME_SCRIPT = `(function(){try{
var k='${STORAGE_KEY}';var c=localStorage.getItem(k)||'dark';
var d=c==='system'?(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):(c==='light'?'light':'dark');
var e=document.documentElement;e.classList.toggle('dark',d!=='light');e.style.colorScheme=d;
}catch(_){document.documentElement.classList.add('dark');}})();`;
