import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
	resolveSoftKeyboardAction,
	SUPPORTED_SOFT_KEYBOARD_IDS,
	SUPPORTED_SOFT_KEYBOARD_KEYS
} from './soft-keyboard';

describe('terminal soft keyboard', () => {
	test('exposes only keys with real UI behavior', () => {
		assert.equal(SUPPORTED_SOFT_KEYBOARD_IDS.includes('enter' as never), false);
		assert.equal(SUPPORTED_SOFT_KEYBOARD_IDS.includes('ctrlHold' as never), false);
		assert.deepEqual(SUPPORTED_SOFT_KEYBOARD_KEYS.map((key) => key.id), [...SUPPORTED_SOFT_KEYBOARD_IDS]);
	});

	test('maps terminal navigation sequences exactly', () => {
		assert.deepEqual(resolveSoftKeyboardAction('esc'), { kind: 'input', data: '\x1b' });
		assert.deepEqual(resolveSoftKeyboardAction('tab'), { kind: 'input', data: '\t' });
		assert.deepEqual(resolveSoftKeyboardAction('shiftTab'), { kind: 'input', data: '\x1b[Z' });
		assert.deepEqual(resolveSoftKeyboardAction('left'), { kind: 'input', data: '\x1b[D' });
		assert.deepEqual(resolveSoftKeyboardAction('up'), { kind: 'input', data: '\x1b[A' });
		assert.deepEqual(resolveSoftKeyboardAction('down'), { kind: 'input', data: '\x1b[B' });
		assert.deepEqual(resolveSoftKeyboardAction('right'), { kind: 'input', data: '\x1b[C' });
	});

	test('maps interrupt and local helper actions', () => {
		assert.deepEqual(resolveSoftKeyboardAction('interrupt'), { kind: 'control', key: 'c' });
		assert.deepEqual(resolveSoftKeyboardAction('clear'), { kind: 'clear' });
		assert.deepEqual(resolveSoftKeyboardAction('paste'), { kind: 'paste' });
		assert.deepEqual(resolveSoftKeyboardAction('copy'), { kind: 'copy' });
		assert.deepEqual(resolveSoftKeyboardAction('selectAll'), { kind: 'selectAll' });
	});

	test('does not invent behavior for stale React preference keys', () => {
		assert.equal(resolveSoftKeyboardAction('enter'), null);
		assert.equal(resolveSoftKeyboardAction('ctrlHold'), null);
	});
});
