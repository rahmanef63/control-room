import {
  APP_SETTINGS_STORAGE_KEY,
  HISTORY_STORAGE_KEY,
  TEMPLATES_STORAGE_KEY,
  WORKSPACE_ACTIVE_KEY,
  WORKSPACE_SESSION_MAP_KEY,
  WORKSPACES_STORAGE_KEY,
} from '@/features/terminals/lib/utils';

export const BACKUP_KEYS = [
  WORKSPACES_STORAGE_KEY,
  WORKSPACE_ACTIVE_KEY,
  WORKSPACE_SESSION_MAP_KEY,
  HISTORY_STORAGE_KEY,
  APP_SETTINGS_STORAGE_KEY,
  TEMPLATES_STORAGE_KEY,
] as const;

export interface BackupPayload {
  version: 1;
  exportedAt: number;
  appName: string;
  data: Record<string, unknown>;
}

export function buildBackup(): BackupPayload {
  const data: Record<string, unknown> = {};
  if (typeof window !== 'undefined') {
    for (const key of BACKUP_KEYS) {
      const raw = window.localStorage.getItem(key);
      if (raw == null) continue;
      try {
        data[key] = JSON.parse(raw);
      } catch {
        data[key] = raw;
      }
    }
  }
  return {
    version: 1,
    exportedAt: Date.now(),
    appName: 'vps-control-room',
    data,
  };
}

export function downloadBackup(): void {
  if (typeof window === 'undefined') return;
  const payload = buildBackup();
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  a.download = `vps-control-room-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface ImportBackupOptions {
  merge?: boolean;
}

export async function importBackupFromFile(
  file: File,
  options: ImportBackupOptions = {}
): Promise<BackupPayload> {
  if (typeof window === 'undefined') {
    throw new Error('Backup import requires a browser environment');
  }
  const text = await file.text();
  const parsed = JSON.parse(text) as BackupPayload;
  if (!parsed || parsed.version !== 1 || !parsed.data) {
    throw new Error('Unsupported backup format');
  }

  if (!options.merge) {
    for (const key of BACKUP_KEYS) {
      window.localStorage.removeItem(key);
    }
  }

  for (const [key, value] of Object.entries(parsed.data)) {
    if (!BACKUP_KEYS.includes(key as (typeof BACKUP_KEYS)[number])) continue;
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    window.localStorage.setItem(key, serialized);
  }

  return parsed;
}

export async function pickAndImportBackup(
  options: ImportBackupOptions = {}
): Promise<BackupPayload | null> {
  if (typeof window === 'undefined') return null;
  return await new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      try {
        const payload = await importBackupFromFile(file, options);
        resolve(payload);
      } catch (err) {
        reject(err);
      }
    };
    input.click();
  });
}
