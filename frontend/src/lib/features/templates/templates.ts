import type { TerminalCreateRequest, TerminalProfile, TerminalSession } from '$lib/features/terminals/types';

export const TEMPLATES_STORAGE_KEY = 'vps-control-room.templates';
const TEMPLATE_COLORS = ['#38bdf8', '#a855f7', '#f59e0b', '#34d399', '#fb7185', '#818cf8'] as const;

export interface TerminalTemplate {
	id: string;
	name: string;
	description?: string;
	color?: string;
	profile?: TerminalProfile;
	agentProfileId?: string;
	environmentId?: string;
	cwd?: string;
	initialCommand?: string;
	customTitle?: string;
	workspaceId?: string;
	createdAt: number;
	updatedAt: number;
}

export interface TemplateCreateInput {
	name: string;
	description?: string;
	color?: string;
	profile?: TerminalProfile;
	agentProfileId?: string;
	environmentId?: string;
	cwd?: string;
	initialCommand?: string;
	customTitle?: string;
	workspaceId?: string;
}

export type TemplateUpdateInput = Partial<TemplateCreateInput>;

export function normalizeTemplates(value: unknown): TerminalTemplate[] {
	if (!Array.isArray(value)) return [];
	return value.filter(
		(entry): entry is TerminalTemplate =>
			Boolean(entry) &&
			typeof entry === 'object' &&
			typeof (entry as { id?: unknown }).id === 'string'
	);
}

function makeTemplateId(now = Date.now(), random = Math.random()): string {
	return `tmpl_${now.toString(36)}_${random.toString(36).slice(2, 8)}`;
}

export function pickTemplateColor(existing: readonly TerminalTemplate[]): string {
	const used = new Set(existing.map((template) => template.color).filter(Boolean));
	return TEMPLATE_COLORS.find((color) => !used.has(color)) ?? TEMPLATE_COLORS[existing.length % TEMPLATE_COLORS.length];
}

export function createTemplateEntry(
	current: readonly TerminalTemplate[],
	input: TemplateCreateInput,
	now = Date.now(),
	id = makeTemplateId(now)
): TerminalTemplate {
	return {
		id,
		name: input.name.trim() || 'untitled',
		description: input.description?.trim() || undefined,
		color: input.color || pickTemplateColor(current),
		profile: input.profile,
		agentProfileId: input.agentProfileId || undefined,
		environmentId: input.environmentId || undefined,
		cwd: input.cwd?.trim() || undefined,
		initialCommand: input.initialCommand?.trim() || undefined,
		customTitle: input.customTitle?.trim() || undefined,
		workspaceId: input.workspaceId || undefined,
		createdAt: now,
		updatedAt: now
	};
}

export function updateTemplateEntry(
	current: readonly TerminalTemplate[],
	id: string,
	input: TemplateUpdateInput,
	now = Date.now()
): { templates: TerminalTemplate[]; updated: TerminalTemplate | null } {
	const index = current.findIndex((template) => template.id === id);
	if (index === -1) return { templates: current as TerminalTemplate[], updated: null };
	const updated: TerminalTemplate = { ...current[index], ...input, updatedAt: now };
	const templates = [...current];
	templates[index] = updated;
	return { templates, updated };
}

export function duplicateTemplateEntry(
	current: readonly TerminalTemplate[],
	id: string,
	now = Date.now(),
	newId = makeTemplateId(now)
): { templates: TerminalTemplate[]; duplicate: TerminalTemplate | null } {
	const source = current.find((template) => template.id === id);
	if (!source) return { templates: current as TerminalTemplate[], duplicate: null };
	const duplicate: TerminalTemplate = {
		...source,
		id: newId,
		name: `${source.name} (copy)`,
		createdAt: now,
		updatedAt: now
	};
	return { templates: [...current, duplicate], duplicate };
}

export function templateLaunchRequest(template: TerminalTemplate): TerminalCreateRequest {
	const request: TerminalCreateRequest = {};
	if (template.profile) request.profile = template.profile;
	if (template.agentProfileId) request.agentProfileId = template.agentProfileId;
	if (template.environmentId) request.environmentId = template.environmentId;
	if (template.cwd) request.cwd = template.cwd;
	return request;
}

export function templateInitialCommandInput(template: TerminalTemplate): string | null {
	return template.initialCommand ? `${template.initialCommand}\r` : null;
}

export function templateInputFromSession(
	session: TerminalSession,
	workspaceId?: string
): TemplateCreateInput {
	return {
		name: session.title,
		profile: session.profile,
		agentProfileId: session.agent_profile_id,
		environmentId: session.environment_id,
		cwd: session.cwd,
		customTitle: session.title,
		workspaceId
	};
}
