// Pure helpers for terminal drag-and-drop / clipboard uploads. Kept free of
// Svelte and xterm imports so they can be unit-tested without mounting UI.

// Mirror agent/src/terminal/gateway/http.ts's MAX_UPLOAD_BYTES.
export const MAX_UPLOAD_BYTES = 26_214_400; // 25 MiB

/** Quote a path for safe insertion at an interactive shell prompt. */
export function quoteShellPath(path: string): string {
	if (path === '~' || /^~\/[\w@%+=:,./~-]*$/.test(path)) return path;
	if (/^[\w@%+=:,./~-]+$/.test(path)) return path;
	return `'${path.replace(/'/g, `'\\''`)}'`;
}

/** Split files into uploadable files and files over the configured cap. */
export function partitionBySize(
	files: File[],
	max = MAX_UPLOAD_BYTES
): { ok: File[]; tooBig: File[] } {
	const ok: File[] = [];
	const tooBig: File[] = [];
	for (const file of files) (file.size > max ? tooBig : ok).push(file);
	return { ok, tooBig };
}

/** Wrap a clipboard image blob in a named File with a sensible extension. */
export function imageFileFromBlob(blob: Blob, index = 0, now = Date.now()): File {
	const ext = (blob.type.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '') || 'png';
	const suffix = index > 0 ? `-${index}` : '';
	return new File([blob], `pasted-${now}${suffix}.${ext}`, { type: blob.type });
}

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

/** Extract files from a drop and explicitly skip dropped directories. */
export function filesFromDrop(dt: DropLike): { files: File[]; skippedDirs: string[] } {
	const files: File[] = [];
	const skippedDirs: string[] = [];
	const items = dt.items;
	if (items && items.length) {
		for (let index = 0; index < items.length; index += 1) {
			const item = items[index];
			if (item.kind !== 'file') continue;
			const entry = item.webkitGetAsEntry?.();
			if (entry?.isDirectory) {
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
