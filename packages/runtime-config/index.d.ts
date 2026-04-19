import type {
  RuntimeConfig,
  RuntimeConfigResponse,
  RuntimeEnvironmentSummary,
  RuntimeResolvedAgentProfile,
} from "../contracts/index.js";

export interface RuntimeConfigIOOptions {
  configPath?: string;
}

export const DEFAULT_RUNTIME_CONFIG: RuntimeConfig;

export function getDefaultRuntimeConfigPath(): string;
export function getRuntimeConfigPath(options?: RuntimeConfigIOOptions): string;
export function parseEnvironmentText(envText: string): Record<string, string>;
export function normalizeRuntimeConfig(input: unknown): RuntimeConfig;
export function readRuntimeConfig(options?: RuntimeConfigIOOptions): RuntimeConfig;
export function writeRuntimeConfig(
  input: RuntimeConfig,
  options?: RuntimeConfigIOOptions,
): RuntimeConfig;
export function listEnvironmentSummaries(
  config?: RuntimeConfig,
): RuntimeEnvironmentSummary[];
export function listResolvedAgentProfiles(
  config?: RuntimeConfig,
): RuntimeResolvedAgentProfile[];
export function buildRuntimeConfigResponse(
  config?: RuntimeConfig,
  options?: RuntimeConfigIOOptions,
): RuntimeConfigResponse;
