// Pure helpers for drag-and-drop / paste uploads. Kept free of React + xterm
// imports so they unit-test under `node --test` without a DOM.

// Mirror the agent's MAX_UPLOAD_BYTES so the client rejects oversized files
// before wasting a round-trip. Keep both in sync.
export const MAX_UPLOAD_BYTES = 26_214_400; // 25 MiB

/** Quote a path for safe interpolation into a shell command line. */
export function quoteShellPath(path: string): string {
  if (path === '~' || /^~\/[\w@%+=:,./~-]*$/.test(path)) return path;
  if (/^[\w@%+=:,./~-]+$/.test(path)) return path;
  return `'${path.replace(/'/g, `'\\''`)}'`;
}

/** Split files into those within the size cap and those over it. */
export function partitionBySize(
  files: File[],
  max = MAX_UPLOAD_BYTES
): { ok: File[]; tooBig: File[] } {
  const ok: File[] = [];
  const tooBig: File[] = [];
  for (const file of files) (file.size > max ? tooBig : ok).push(file);
  return { ok, tooBig };
}

/** Wrap a clipboard/drag image blob in a named File with a sensible extension. */
export function imageFileFromBlob(blob: Blob, index = 0, now = Date.now()): File {
  const ext = (blob.type.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '') || 'png';
  const suffix = index > 0 ? `-${index}` : '';
  return new File([blob], `pasted-${now}${suffix}.${ext}`, { type: blob.type });
}

// Minimal structural view of a DataTransfer so this stays testable with a fake.
interface DropEntry {
  isDirectory: boolean;
  name: string;
}
interface DropItem {
  kind: string;
  getAsFile(): File | null;
  webkitGetAsEntry?: () => DropEntry | null;
}
interface DropLike {
  items?: ArrayLike<DropItem> | null;
  files?: ArrayLike<File> | null;
}

/**
 * Extract uploadable files from a drop, filtering out dropped directories
 * (which the browser can't read as bytes). Returns the skipped folder names so
 * the caller can warn. Falls back to the flat file list when the items API is
 * unavailable.
 */
export function filesFromDrop(dt: DropLike): { files: File[]; skippedDirs: string[] } {
  const files: File[] = [];
  const skippedDirs: string[] = [];
  const items = dt.items;
  if (items && items.length) {
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item.kind !== 'file') continue;
      const entry = item.webkitGetAsEntry?.();
      if (entry && entry.isDirectory) {
        skippedDirs.push(entry.name);
        continue;
      }
      const file = item.getAsFile();
      if (file) files.push(file);
    }
    return { files, skippedDirs };
  }
  return { files: Array.from(dt.files ?? []), skippedDirs };
}
