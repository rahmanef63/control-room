export interface HostTelemetry {
	timestamp?: number;
	cpu_total: number;
	cpu_cores: number[];
	ram_total: number;
	ram_used: number;
	ram_available: number;
	disk: Array<{ mount: string; total: number; used: number; available: number }>;
	network: { rx_bytes: number; tx_bytes: number; rx_rate: number; tx_rate: number };
	uptime_seconds: number;
	load_average: number[];
}

export interface HostRuntimeSummary {
	terminal_sessions: number;
	terminal_profiles: number;
	environments: number;
	agent_profiles: number;
}

export interface HostOverview {
	status?: string;
	runtime?: HostRuntimeSummary;
	telemetry?: HostTelemetry | null;
}

export function formatBytes(value: number): string {
	if (!Number.isFinite(value) || value <= 0) return '0 B';
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
	return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function formatUptime(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds <= 0) return '—';
	const whole = Math.floor(seconds);
	const days = Math.floor(whole / 86400);
	const hours = Math.floor((whole % 86400) / 3600);
	const minutes = Math.floor((whole % 3600) / 60);
	if (days > 0) return `${days}d ${hours}h`;
	if (hours > 0) return `${hours}h ${minutes}m`;
	return `${minutes}m`;
}

export function usagePercent(used: number, total: number): number {
	if (!Number.isFinite(used) || !Number.isFinite(total) || total <= 0) return 0;
	return Math.max(0, Math.min(100, (used / total) * 100));
}

export function usageTone(percent: number): 'good' | 'warn' | 'danger' {
	if (percent >= 90) return 'danger';
	if (percent >= 70) return 'warn';
	return 'good';
}
