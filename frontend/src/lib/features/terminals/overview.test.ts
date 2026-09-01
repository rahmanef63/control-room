import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { formatBytes, formatUptime, usagePercent, usageTone } from './overview';

describe('terminal overview helpers', () => {
	test('formats bytes using compact binary units', () => {
		assert.equal(formatBytes(0), '0 B');
		assert.equal(formatBytes(1024), '1.0 KB');
		assert.equal(formatBytes(1024 ** 3 * 1.5), '1.5 GB');
	});

	test('formats host uptime without noisy seconds', () => {
		assert.equal(formatUptime(0), '—');
		assert.equal(formatUptime(65), '1m');
		assert.equal(formatUptime(3665), '1h 1m');
		assert.equal(formatUptime(90000), '1d 1h');
	});

	test('clamps usage percentages and maps status tones', () => {
		assert.equal(usagePercent(50, 100), 50);
		assert.equal(usagePercent(150, 100), 100);
		assert.equal(usagePercent(1, 0), 0);
		assert.equal(usageTone(69.9), 'good');
		assert.equal(usageTone(70), 'warn');
		assert.equal(usageTone(90), 'danger');
	});
});
