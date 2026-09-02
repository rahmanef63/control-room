import { quoteShellPath } from './upload';

type SkillScope = 'global' | 'project';

export interface SkillSummary {
	id: string;
	name: string;
	description: string;
	invocation: string;
	scope: SkillScope;
	source: string;
}

export interface FsEntry {
	name: string;
	path: string;
	isDir: boolean;
}

export interface FsRoot {
	label: string;
	path: string;
}

export interface FsListResult {
	path: string;
	parent: string | null;
	roots: FsRoot[];
	entries: FsEntry[];
}

export function buildChangeDirectoryCommand(path: string): string {
	return `cd ${quoteShellPath(path)}`;
}

export function groupSkills(skills: readonly SkillSummary[]): {
	project: SkillSummary[];
	global: SkillSummary[];
} {
	return {
		project: skills.filter((skill) => skill.scope === 'project'),
		global: skills.filter((skill) => skill.scope === 'global')
	};
}

export function filterDirectories(entries: readonly FsEntry[], query: string): FsEntry[] {
	const dirs = entries.filter((entry) => entry.isDir);
	const needle = query.trim().toLowerCase();
	if (!needle) return dirs;
	return dirs.filter((entry) => entry.name.toLowerCase().includes(needle));
}

export function buildCrumbs(currentPath: string, roots: readonly FsRoot[]): FsRoot[] {
	const root = [...roots]
		.sort((a, b) => b.path.length - a.path.length)
		.find((candidate) =>
			currentPath === candidate.path || currentPath.startsWith(`${candidate.path}/`)
		);
	if (!root) return [{ label: currentPath, path: currentPath }];
	const relative = currentPath.slice(root.path.length).split('/').filter(Boolean);
	const crumbs: FsRoot[] = [{ label: root.label, path: root.path }];
	let running = root.path;
	for (const segment of relative) {
		running = `${running}/${segment}`;
		crumbs.push({ label: segment, path: running });
	}
	return crumbs;
}
