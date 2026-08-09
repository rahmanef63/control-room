'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Clock,
  Download,
  DownloadCloud,
  Globe,
  ShieldCheck,
  UploadCloud,
  X,
} from 'lucide-react';

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
  devicesPendingCount: number;
  canInstall: boolean;
  onClose: () => void;
  onUpdateNotifications: (patch: Partial<NotificationSettings>) => void;
  onUpdateSoftKeyboard: (patch: Partial<SoftKeyboardSettings>) => void;
  onSetSoftKeyVisible: (key: SoftKeyboardKey, visible: boolean) => void;
  onOpenCrons: () => void;
  onOpenDevices: () => void;
  onExportBackup: () => void;
  onImportBackup: () => void;
  onInstall: () => void;
  onResetDefaults: () => void;
}

export function SettingsDrawer({
  open,
  notifications,
  softKeyboard,
  devicesPendingCount,
  canInstall,
  onClose,
  onUpdateNotifications,
  onUpdateSoftKeyboard,
  onSetSoftKeyVisible,
  onOpenCrons,
  onOpenDevices,
  onExportBackup,
  onImportBackup,
  onInstall,
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

  // Rows that hand off to another drawer close this one first, so the user is
  // never left with two stacked overlays and an ambiguous Escape target.
  function navigateTo(openTarget: () => void) {
    onClose();
    openTarget();
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
          <h3>Terminals</h3>
          <label className="settings-row">
            <span>
              Soft keyboard bar
              <span className="settings-hint"> · shortcut keys under each pane</span>
            </span>
            <input
              type="checkbox"
              checked={!softKeyboard.hideKeyboard}
              onChange={(e) => onUpdateSoftKeyboard({ hideKeyboard: !e.target.checked })}
            />
          </label>
          <p className="settings-help">
            Pick which keys the bar offers. Unchecked keys stay off every pane.
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

        <section className="settings-section">
          <h3>Automation</h3>
          <button
            type="button"
            onClick={() => navigateTo(onOpenCrons)}
            className="settings-nav-row"
          >
            <Clock className="h-4 w-4 shrink-0" />
            <span className="settings-nav-text">
              <span className="settings-nav-title">Scheduled jobs</span>
              <span className="settings-nav-sub">Run a command or agent on a cron schedule</span>
            </span>
            <ChevronRight className="settings-nav-chevron h-4 w-4" aria-hidden="true" />
          </button>
        </section>

        <section className="settings-section">
          <h3>Security</h3>
          <button
            type="button"
            onClick={() => navigateTo(onOpenDevices)}
            className="settings-nav-row"
          >
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span className="settings-nav-text">
              <span className="settings-nav-title">Sign-in approvals</span>
              <span className="settings-nav-sub">Approve or revoke devices that can sign in</span>
            </span>
            {devicesPendingCount > 0 ? (
              <span className="settings-nav-badge">{devicesPendingCount} waiting</span>
            ) : null}
            <ChevronRight className="settings-nav-chevron h-4 w-4" aria-hidden="true" />
          </button>
        </section>

        <section className="settings-section">
          <h3>Data</h3>
          <button type="button" onClick={onExportBackup} className="settings-nav-row">
            <DownloadCloud className="h-4 w-4 shrink-0" />
            <span className="settings-nav-text">
              <span className="settings-nav-title">Export dashboard settings</span>
              <span className="settings-nav-sub">
                Downloads workspaces, templates, settings and history as one JSON file
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={onImportBackup}
            className="settings-nav-row"
            data-danger="true"
          >
            <UploadCloud className="h-4 w-4 shrink-0" />
            <span className="settings-nav-text">
              <span className="settings-nav-title">Import settings…</span>
              {/* Blast radius is stated in the row itself, not only in the confirm()
                  dialog — a browser confirm is easy to click through blind. */}
              <span className="settings-nav-sub">
                Erases your current workspaces, templates, settings and history, replaces them
                with the file, then reloads. No undo — export first.
              </span>
            </span>
          </button>
        </section>

        <section className="settings-section">
          <h3>App</h3>
          {canInstall ? (
            <button type="button" onClick={onInstall} className="settings-nav-row">
              <Download className="h-4 w-4 shrink-0" />
              <span className="settings-nav-text">
                <span className="settings-nav-title">Install as app</span>
                <span className="settings-nav-sub">
                  Adds the dashboard to your home screen or dock
                </span>
              </span>
            </button>
          ) : null}
          <Link href="/browser" onClick={onClose} className="settings-nav-row">
            <Globe className="h-4 w-4 shrink-0" />
            <span className="settings-nav-text">
              <span className="settings-nav-title">Browser automation console</span>
              <span className="settings-nav-sub">Drive the host browser session from the web</span>
            </span>
            <ChevronRight className="settings-nav-chevron h-4 w-4" aria-hidden="true" />
          </Link>
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
