'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

import type {
  NotificationSettings,
  SoftKeyboardSettings,
} from '@/features/terminals/hooks/use-app-settings';
import { SOFT_KEYBOARD_KEYS, type SoftKeyboardKey } from '@/features/terminals/lib/utils';
import { useAppearance } from '@/shared/platform';
import type { ThemeChoice } from '@/shared/platform/theme';
import type { OS } from '@/shared/platform/detect';

const OS_STYLE_LABELS: Partial<Record<OS, string>> = {
  ios: 'iOS',
  android: 'Android',
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux',
};

interface SettingsDrawerProps {
  open: boolean;
  notifications: NotificationSettings;
  softKeyboard: SoftKeyboardSettings;
  onClose: () => void;
  onUpdateNotifications: (patch: Partial<NotificationSettings>) => void;
  onUpdateSoftKeyboard: (patch: Partial<SoftKeyboardSettings>) => void;
  onSetSoftKeyVisible: (key: SoftKeyboardKey, visible: boolean) => void;
  onResetDefaults: () => void;
}

export function SettingsDrawer({
  open,
  notifications,
  softKeyboard,
  onClose,
  onUpdateNotifications,
  onUpdateSoftKeyboard,
  onSetSoftKeyVisible,
  onResetDefaults,
}: SettingsDrawerProps) {
  const { os, theme, setTheme, osSkin, setOsSkin } = useAppearance();
  const osStyleLabel = OS_STYLE_LABELS[os];

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  function testHeartbeat() {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-heartbeat-test', 'on');
    setTimeout(() => {
      document.documentElement.removeAttribute('data-heartbeat-test');
    }, 4000);
  }

  return (
    <div className="settings-overlay" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="settings-backdrop" onClick={onClose} />
      <div className="settings-panel">
        <header className="settings-header">
          <h2>Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="topbar-icon-button"
            aria-label="Close settings"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <section className="settings-section">
          <h3>Appearance</h3>
          <label className="settings-row">
            <span>Theme</span>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as ThemeChoice)}
              className="settings-select"
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label className="settings-row">
            <span>
              Match this OS style
              {osStyleLabel ? <span className="settings-hint"> · {osStyleLabel}</span> : null}
            </span>
            <input
              type="checkbox"
              checked={osSkin}
              onChange={(e) => setOsSkin(e.target.checked)}
            />
          </label>
          <p className="settings-help">
            Theme follows your system unless you choose Light or Dark. OS style nudges fonts and
            corner radius toward this platform. Terminal colors stay dark.
          </p>
        </section>

        <section className="settings-section">
          <h3>Notifications</h3>
          <label className="settings-row">
            <span>
              Heartbeat glow when working
              <span className="settings-hint"> · outer-ring pulse on the pane</span>
            </span>
            <input
              type="checkbox"
              checked={notifications.heartbeatGlow}
              onChange={(e) => onUpdateNotifications({ heartbeatGlow: e.target.checked })}
            />
          </label>

          <div className="settings-test-row">
            <button
              type="button"
              onClick={testHeartbeat}
              className="new-terminal-trigger flex-1 justify-center"
              title="Pulse the outer-glow on every pane for 4 seconds"
            >
              Test heartbeat
            </button>
          </div>
          <p className="settings-help">
            The heartbeat glow only fires on AI agent sessions
            (Claude / Codex / Gemini) while they are working. Shell terminals stay quiet.
          </p>
        </section>

        <section className="settings-section">
          <h3>Soft keyboard</h3>
          <label className="settings-row">
            <span>Show in grid (show-all) view</span>
            <input
              type="checkbox"
              checked={softKeyboard.showInGrid}
              onChange={(e) => onUpdateSoftKeyboard({ showInGrid: e.target.checked })}
            />
          </label>
          <p className="settings-help">
            Mobile always shows keyboard. This toggle only affects desktop grid view.
          </p>

          <div className="settings-grid">
            {SOFT_KEYBOARD_KEYS.map((key) => (
              <label key={key.id} className="settings-key-row">
                <input
                  type="checkbox"
                  checked={softKeyboard.visibility[key.id] ?? true}
                  onChange={(e) => onSetSoftKeyVisible(key.id, e.target.checked)}
                />
                <span>{key.label}</span>
              </label>
            ))}
          </div>
        </section>

        <footer className="settings-footer">
          <button type="button" onClick={onResetDefaults} className="topbar-icon-button px-3 w-auto">
            Reset defaults
          </button>
        </footer>
      </div>
    </div>
  );
}
