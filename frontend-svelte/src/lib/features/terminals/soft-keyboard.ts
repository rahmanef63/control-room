import { SOFT_KEYBOARD_KEYS, type SoftKeyboardKey } from './types';

export const SOFT_KEYBOARD_ROW_1 = ['esc', 'shiftTab', 'tab', 'interrupt'] as const satisfies readonly SoftKeyboardKey[];
export const SOFT_KEYBOARD_ROW_2 = [
	'left',
	'up',
	'down',
	'right',
	'clear',
	'paste',
	'copy',
	'selectAll'
] as const satisfies readonly SoftKeyboardKey[];

export const SUPPORTED_SOFT_KEYBOARD_IDS = [
	...SOFT_KEYBOARD_ROW_1,
	...SOFT_KEYBOARD_ROW_2
] as const satisfies readonly SoftKeyboardKey[];

const keyById = new Map(SOFT_KEYBOARD_KEYS.map((key) => [key.id, key] as const));
export const SUPPORTED_SOFT_KEYBOARD_KEYS = SUPPORTED_SOFT_KEYBOARD_IDS.map((id) => keyById.get(id)!);

export type SoftKeyboardAction =
	| { kind: 'input'; data: string }
	| { kind: 'control'; key: string }
	| { kind: 'clear' }
	| { kind: 'paste' }
	| { kind: 'copy' }
	| { kind: 'selectAll' };

export function resolveSoftKeyboardAction(id: SoftKeyboardKey): SoftKeyboardAction | null {
	switch (id) {
		case 'esc':
			return { kind: 'input', data: '\x1b' };
		case 'tab':
			return { kind: 'input', data: '\t' };
		case 'shiftTab':
			return { kind: 'input', data: '\x1b[Z' };
		case 'left':
			return { kind: 'input', data: '\x1b[D' };
		case 'up':
			return { kind: 'input', data: '\x1b[A' };
		case 'down':
			return { kind: 'input', data: '\x1b[B' };
		case 'right':
			return { kind: 'input', data: '\x1b[C' };
		case 'interrupt':
			return { kind: 'control', key: 'c' };
		case 'clear':
			return { kind: 'clear' };
		case 'paste':
			return { kind: 'paste' };
		case 'copy':
			return { kind: 'copy' };
		case 'selectAll':
			return { kind: 'selectAll' };
		// `enter` and `ctrlHold` existed as legacy preference keys in React but
		// PaneSoftKeyboard never rendered or implemented them. Keep the storage
		// schema compatible while refusing to expose controls with invented semantics.
		case 'enter':
		case 'ctrlHold':
			return null;
	}
}

export function isClipboardSoftKey(id: SoftKeyboardKey): boolean {
	return id === 'paste' || id === 'copy' || id === 'selectAll';
}
