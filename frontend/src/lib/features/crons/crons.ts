import type { TerminalProfile } from '$lib/features/terminals/types';

type CronActionSpawn = {
	type: 'spawn';
	profile?: TerminalProfile;
	agentProfileId?: string;
	environmentId?: string;
	cwd?: string;
	initialCommand?: string;
};

type CronActionSendInput = {
	type: 'send_input';
	sessionId: string;
	data: string;
};

type CronAction = CronActionSpawn | CronActionSendInput;

export interface CronEntry {
	id: string;
	name: string;
	cronExpr: string;
	enabled: boolean;
	workspaceId?: string;
	action: CronAction;
	createdAt: number;
	updatedAt: number;
	lastRunAt?: number;
	lastResult?: { ok: boolean; message?: string; sessionId?: string };
}

export interface CronCreateInput {
	name: string;
	cronExpr: string;
	enabled?: boolean;
	workspaceId?: string;
	action: CronAction;
}

export interface CronUpdateInput {
	name?: string;
	cronExpr?: string;
	enabled?: boolean;
	workspaceId?: string;
	action?: CronAction;
}

export interface CronFormState {
	id?: string;
	name: string;
	cronExpr: string;
	enabled: boolean;
	actionType: CronAction['type'];
	profile: TerminalProfile | '';
	agentProfileId: string;
	environmentId: string;
	cwd: string;
	initialCommand: string;
	sessionId: string;
	data: string;
}

export function encodeCronInputData(value: string): string {
	return value.replace(/\\/g, '\\\\').replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\t/g, '\\t');
}

export function decodeCronInputData(value: string): string {
	let output = '';
	for (let index = 0; index < value.length; index += 1) {
		const char = value[index];
		if (char !== '\\' || index + 1 >= value.length) {
			output += char;
			continue;
		}
		const next = value[index + 1];
		if (next === 'r') output += '\r';
		else if (next === 'n') output += '\n';
		else if (next === 't') output += '\t';
		else if (next === '\\') output += '\\';
		else { output += `\\${next}`; }
		index += 1;
	}
	return output;
}

export function emptyCronForm(): CronFormState {
	return {
		name: '',
		cronExpr: '*/5 * * * *',
		enabled: true,
		actionType: 'spawn',
		profile: 'shell',
		agentProfileId: '',
		environmentId: '',
		cwd: '',
		initialCommand: '',
		sessionId: '',
		data: ''
	};
}

export function cronEntryToForm(entry: CronEntry): CronFormState {
	if (entry.action.type === 'spawn') {
		return {
			id: entry.id,
			name: entry.name,
			cronExpr: entry.cronExpr,
			enabled: entry.enabled,
			actionType: 'spawn',
			profile: entry.action.profile ?? 'shell',
			agentProfileId: entry.action.agentProfileId ?? '',
			environmentId: entry.action.environmentId ?? '',
			cwd: entry.action.cwd ?? '',
			initialCommand: entry.action.initialCommand ?? '',
			sessionId: '',
			data: ''
		};
	}
	return {
		id: entry.id,
		name: entry.name,
		cronExpr: entry.cronExpr,
		enabled: entry.enabled,
		actionType: 'send_input',
		profile: 'shell',
		agentProfileId: '',
		environmentId: '',
		cwd: '',
		initialCommand: '',
		sessionId: entry.action.sessionId,
		data: encodeCronInputData(entry.action.data)
	};
}

export function cronFormToInput(form: CronFormState): CronCreateInput {
	const action: CronAction =
		form.actionType === 'spawn'
			? {
				type: 'spawn',
				profile: form.profile || undefined,
				agentProfileId: form.agentProfileId || undefined,
				environmentId: form.environmentId || undefined,
				cwd: form.cwd.trim() || undefined,
				initialCommand: form.initialCommand.trim() || undefined
			}
			: {
				type: 'send_input',
				sessionId: form.sessionId,
				data: decodeCronInputData(form.data)
			};
	return {
		name: form.name,
		cronExpr: form.cronExpr,
		enabled: form.enabled,
		action
	};
}

export function cronRunLabel(entry: CronEntry): string {
	if (!entry.lastRunAt) return 'Never run';
	if (!entry.lastResult) return 'Run recorded';
	return entry.lastResult.ok ? 'Last run succeeded' : entry.lastResult.message || 'Last run failed';
}
