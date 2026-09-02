interface SiCoderToolDescriptor {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
}

export interface SiCoderToolSurface {
	installed: boolean;
	version: string | null;
	tools: SiCoderToolDescriptor[];
}

interface SiCoderCredentialStatus {
	key: string;
	required: boolean;
	secret: boolean;
	state: string;
	stored: boolean;
	valid: boolean;
	owner?: string;
	readable: false;
	connection: string | null;
}

export interface SiCoderProviderStatus {
	user: string;
	id: string;
	title: string;
	blurb: string;
	providerStatus: string;
	connection: string | null;
	connectionLabel: string | null;
	authMethod: string;
	scope: string;
	connectionCount: number;
	defaultConnection: string | null;
	legacy: boolean;
	state: string;
	stored: number;
	total: number;
	invalid: number;
	missingRequired: number;
	credentials: SiCoderCredentialStatus[];
	external?: boolean;
	composio?: {
		toolkit?: string;
		authSchemes?: string[];
		managedAuth?: boolean;
		mcpToolkit?: string;
		mcpAuthScheme?: string;
		source?: string;
	} | null;
}

interface SiCoderUserSummary {
	name: string;
	owner: string;
	credentialCount: number;
	legacyCredentialCount: number;
	connectionCount: number;
	isDefault: boolean;
	isCurrent: boolean;
	folders: string[];
	providers: Array<{
		id: string;
		state: string;
		stored: number;
		total: number;
		connectionCount: number;
		defaultConnection: string | null;
		connection: string | null;
		authMethod: string;
		invalid: number;
		missingRequired: number;
	}>;
}

export interface SiCoderUsersResponse {
	defaultUser: string | null;
	currentUser: string | null;
	currentReason: string;
	users: SiCoderUserSummary[];
}


export interface SiCoderUserResolution {
	cwd: string;
	user: string | null;
	unresolvedUser: string | null;
	reason: string;
	rule: string | null;
	defaultUser: string | null;
	mappings: Array<{ path?: string; user?: string }>;
}

export interface SiCoderConnectionStatus {
	user: string;
	provider: string;
	id: string;
	label: string;
	authMethod: string;
	scheme: string;
	scope: string;
	isDefault: boolean;
	external: boolean;
	state: string;
	stored: number;
	total: number;
	invalid: number;
	missingRequired: number;
	credentials: SiCoderCredentialStatus[];
	composio?: SiCoderProviderStatus['composio'];
}

export interface SiCoderConnectionRequest {
	user: string;
	provider: string;
	authMethods?: Array<{
		id: string;
		label: string;
		scheme: string;
		scope: string;
		external: boolean;
		recommended: string | null;
		fields: string[];
		requiredFields: string[];
	}>;
	connection?: SiCoderConnectionStatus;
	managedConnectionAction?: Record<string, unknown> | null;
	next?: string;
	policy?: string;
}

export interface SiCoderCredentialRequest extends SiCoderCredentialStatus {
	requiresUserTerminal: true;
	command: string;
	userAction?: {
		title?: string;
		message?: string;
		primaryAction?: { label?: string; url?: string } | null;
		navigation?: string[];
		navigationText?: string;
		instructions?: string;
		after?: string;
	} | null;
	referenceUrl?: string | null;
	createCommand?: string | null;
	navigation?: string[];
	navigationText?: string | null;
	policy: string;
}

interface SiCoderToolEnvelope<T> {
	ok: boolean;
	result: T;
	error?: string;
}

export async function loadSiCoderSurface(): Promise<SiCoderToolSurface> {
	const response = await fetch('/api/si-coder/tools', { cache: 'no-store' });
	const payload = (await response.json()) as SiCoderToolSurface & { error?: string };
	if (!response.ok) throw new Error(payload.error || `SI-Coder tools ${response.status}`);
	return payload;
}

export async function callSiCoderTool<T>(
	name: string,
	arguments_: Record<string, unknown> = {}
): Promise<T> {
	const response = await fetch('/api/si-coder/tools/call', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ name, arguments: arguments_ })
	});
	const payload = (await response.json()) as SiCoderToolEnvelope<T> & { error?: string };
	if (!response.ok || !payload.ok) {
		throw new Error(payload.error || `SI-Coder tool ${name} failed (${response.status})`);
	}
	return payload.result;
}

export function providerStateTone(state: string): 'ready' | 'warn' | 'muted' | 'danger' {
	if (state === 'ready') return 'ready';
	if (state === 'invalid') return 'danger';
	if (state === 'incomplete') return 'warn';
	return 'muted';
}

export function chooseInitialSiCoderUser(data: SiCoderUsersResponse, resolvedUser: string | null = null): string | null {
	if (resolvedUser && data.users.some((user) => user.name === resolvedUser)) return resolvedUser;
	return data.defaultUser ?? data.currentUser ?? data.users[0]?.name ?? null;
}
