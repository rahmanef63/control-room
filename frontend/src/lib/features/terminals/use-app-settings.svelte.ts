// Svelte 5 runes port of
// frontend/src/features/terminals/hooks/use-app-settings.ts. Same
// hydrate-then-persist pattern as the original (read localStorage once on
// mount, write back on every change after that) so SSR/first-paint never
// touches `window`.

import { onMount } from 'svelte';

import { readLocal, writeLocal } from '$lib/local-storage';
import { APP_SETTINGS_STORAGE_KEY, SOFT_KEYBOARD_KEYS, type SoftKeyboardKey } from './types';

export interface NotificationSettings {
	/** Pulse an outer-glow ring on the pane while the agent is working. */
	heartbeatGlow: boolean;
}

export interface SoftKeyboardSettings {
	visibility: Record<SoftKeyboardKey, boolean>;
	/** Master hide override — when true, hide keyboard everywhere. */
	hideKeyboard: boolean;
}

interface AppSettings {
	notifications: NotificationSettings;
	softKeyboard: SoftKeyboardSettings;
}

function defaultVisibility(): Record<SoftKeyboardKey, boolean> {
	const map = {} as Record<SoftKeyboardKey, boolean>;
	for (const key of SOFT_KEYBOARD_KEYS) {
		map[key.id] = true;
	}
	return map;
}

const DEFAULT_SETTINGS: AppSettings = {
	notifications: {
		heartbeatGlow: true
	},
	softKeyboard: {
		visibility: defaultVisibility(),
		hideKeyboard: false
	}
};

function readSettings(): AppSettings {
	const parsed = readLocal<Partial<AppSettings> | null>(APP_SETTINGS_STORAGE_KEY, null);
	return parsed ? mergeSettings(parsed) : DEFAULT_SETTINGS;
}

function mergeSettings(input: Partial<AppSettings>): AppSettings {
	const visibility = { ...defaultVisibility(), ...(input.softKeyboard?.visibility ?? {}) };
	return {
		notifications: { ...DEFAULT_SETTINGS.notifications, ...(input.notifications ?? {}) },
		softKeyboard: {
			visibility,
			hideKeyboard: input.softKeyboard?.hideKeyboard ?? DEFAULT_SETTINGS.softKeyboard.hideKeyboard
		}
	};
}

function writeSettings(settings: AppSettings): void {
	writeLocal(APP_SETTINGS_STORAGE_KEY, settings);
}

export interface UseAppSettingsResult {
	readonly settings: AppSettings;
	updateNotifications: (patch: Partial<NotificationSettings>) => void;
	updateSoftKeyboard: (patch: Partial<SoftKeyboardSettings>) => void;
	setSoftKeyVisible: (key: SoftKeyboardKey, visible: boolean) => void;
	toggleHideKeyboard: () => void;
	resetDefaults: () => void;
}

export function useAppSettings(): UseAppSettingsResult {
	let settings = $state<AppSettings>(DEFAULT_SETTINGS);
	let hydrated = $state(false);

	// Mount-only: adopt whatever's in localStorage once, client-side only.
	onMount(() => {
		settings = readSettings();
		hydrated = true;
	});

	// Persist on every change after hydration (including the hydration
	// assignment itself, which just writes back what was already there).
	$effect(() => {
		const current = settings;
		if (!hydrated) return;
		writeSettings(current);
	});

	function updateNotifications(patch: Partial<NotificationSettings>): void {
		settings = {
			...settings,
			notifications: { ...settings.notifications, ...patch }
		};
	}

	function updateSoftKeyboard(patch: Partial<SoftKeyboardSettings>): void {
		settings = {
			...settings,
			softKeyboard: { ...settings.softKeyboard, ...patch }
		};
	}

	function setSoftKeyVisible(key: SoftKeyboardKey, visible: boolean): void {
		settings = {
			...settings,
			softKeyboard: {
				...settings.softKeyboard,
				visibility: { ...settings.softKeyboard.visibility, [key]: visible }
			}
		};
	}

	function toggleHideKeyboard(): void {
		settings = {
			...settings,
			softKeyboard: {
				...settings.softKeyboard,
				hideKeyboard: !settings.softKeyboard.hideKeyboard
			}
		};
	}

	function resetDefaults(): void {
		settings = DEFAULT_SETTINGS;
	}

	return {
		get settings() {
			return settings;
		},
		updateNotifications,
		updateSoftKeyboard,
		setSoftKeyVisible,
		toggleHideKeyboard,
		resetDefaults
	};
}
