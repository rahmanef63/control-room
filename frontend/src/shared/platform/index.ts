// Public surface of the platform + theme layer. Import from here.
export { PlatformProvider, usePlatform, useTheme, useAppearance } from './platform-provider';
export { detectPlatform, type Platform, type OS, type DisplayMode } from './detect';
export {
  EARLY_THEME_SCRIPT,
  applyTheme,
  getStoredTheme,
  storeTheme,
  type ThemeChoice,
  type ResolvedTheme,
} from './theme';
