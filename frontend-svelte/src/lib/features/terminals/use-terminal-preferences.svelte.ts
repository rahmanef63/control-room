import { onMount } from 'svelte';

import { readLocal, writeLocal } from '$lib/local-storage';
import { clampFontSize } from '$lib/features/terminals/types';

export type ViewMode = 'single' | 'grid';
export type GridCols = 'auto' | '1' | '2' | '3' | '4';

const FONT_SIZE_STORAGE_KEY = 'vps-control-room.terminal-font-sizes';
const VIEW_MODE_STORAGE_KEY = 'vps-control-room.terminal-view-mode';
const GRID_COLS_STORAGE_KEY = 'vps-control-room.terminal-grid-cols';
const GRID_COL_VALUES: GridCols[] = ['auto', '1', '2', '3', '4'];

export function useTerminalPreferences() {
	let fontSizes = $state<Record<string, number>>({});
	let viewMode = $state<ViewMode>('single');
	let gridCols = $state<GridCols>('auto');
	let hydrated = $state(false);

	onMount(() => {
		const parsed = readLocal<Record<string, number>>(FONT_SIZE_STORAGE_KEY, {});
		const cleaned: Record<string, number> = {};
		for (const [id, size] of Object.entries(parsed)) cleaned[id] = clampFontSize(Number(size));
		fontSizes = cleaned;

		try {
			const storedView = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
			if (storedView === 'single' || storedView === 'grid') viewMode = storedView;
			const storedCols = window.localStorage.getItem(GRID_COLS_STORAGE_KEY);
			if (storedCols && GRID_COL_VALUES.includes(storedCols as GridCols)) {
				gridCols = storedCols as GridCols;
			}
		} catch {
			// disabled storage — defaults remain valid.
		}
		hydrated = true;
	});

	$effect(() => {
		if (!hydrated) return;
		writeLocal(FONT_SIZE_STORAGE_KEY, fontSizes);
		if (typeof window === 'undefined') return;
		try {
			window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
			window.localStorage.setItem(GRID_COLS_STORAGE_KEY, gridCols);
		} catch {
			// disabled storage — runtime state still works.
		}
	});

	function setFontSize(id: string, size: number): void {
		fontSizes = { ...fontSizes, [id]: clampFontSize(size) };
	}

	function setViewMode(next: ViewMode): void {
		viewMode = next;
	}

	function setGridCols(next: GridCols): void {
		gridCols = next;
	}

	return {
		get fontSizes() {
			return fontSizes;
		},
		get viewMode() {
			return viewMode;
		},
		get gridCols() {
			return gridCols;
		},
		setFontSize,
		setViewMode,
		setGridCols
	};
}
