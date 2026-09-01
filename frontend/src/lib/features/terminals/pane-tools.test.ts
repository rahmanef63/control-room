import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
	buildChangeDirectoryCommand,
	buildCrumbs,
	filterDirectories,
	groupSkills,
	type SkillSummary
} from './pane-tools';

const skills: SkillSummary[] = [
	{ id: 'local', name: 'Local', description: '', invocation: '/local', scope: 'project', source: 'p' },
	{ id: 'global', name: 'Global', description: '', invocation: '/global', scope: 'global', source: 'g' }
];

describe('pane tools helpers', () => {
	test('quotes a picked directory before injecting cd', () => {
		assert.equal(buildChangeDirectoryCommand('/home/me/with space'), "cd '/home/me/with space'");
		assert.equal(buildChangeDirectoryCommand('/home/me/project'), 'cd /home/me/project');
	});

	test('groups skills without changing invocation strings', () => {
		const grouped = groupSkills(skills);
		assert.deepEqual(grouped.project.map((skill) => skill.invocation), ['/local']);
		assert.deepEqual(grouped.global.map((skill) => skill.invocation), ['/global']);
	});

	test('filters only directories case-insensitively', () => {
		const entries = [
			{ name: 'Alpha', path: '/Alpha', isDir: true },
			{ name: 'beta.txt', path: '/beta.txt', isDir: false },
			{ name: 'Gamma', path: '/Gamma', isDir: true }
		];
		assert.deepEqual(filterDirectories(entries, 'AM').map((entry) => entry.name), ['Gamma']);
	});

	test('builds crumbs from the longest matching root', () => {
		assert.deepEqual(
			buildCrumbs('/home/me/projects/app/src', [
				{ label: 'Home', path: '/home/me' },
				{ label: 'Projects', path: '/home/me/projects' }
			]),
			[
				{ label: 'Projects', path: '/home/me/projects' },
				{ label: 'app', path: '/home/me/projects/app' },
				{ label: 'src', path: '/home/me/projects/app/src' }
			]
		);
	});
});
