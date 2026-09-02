export const MANAGED_APP_IDS = ["hermes", "openclaw"] as const;
export type ManagedAppId = (typeof MANAGED_APP_IDS)[number];

export const MANAGED_APP_ACTIONS = [
  "start",
  "stop",
  "restart",
  "update",
  "rollback",
  "uninstall",
  "backup",
] as const;
export type ManagedAppAction = (typeof MANAGED_APP_ACTIONS)[number];

export type InstallationType =
  | "systemd"
  | "docker-compose"
  | "docker-container"
  | "package"
  | "source"
  | "not-installed";

/** Internal-only installation metadata. Paths and service/container names never cross the API boundary. */
export interface ManagedAppInstallation {
  id: ManagedAppId;
  installationType: InstallationType;
  serviceName?: string;
  composeFile?: string;
  containerName?: string;
  command?: string;
  sourceRoot?: string;
  dashboardUrl?: string;
  dataPaths: string[];
  configPaths: string[];
  updateChannel: "stable" | "beta";
  detectedAt: number;
}

export interface ManagedAppStatus {
  installed: boolean;
  running: boolean;
  state: "not-installed" | "stopped" | "starting" | "running" | "updating" | "rolling-back" | "unhealthy" | "error";
  version: string | null;
  updateAvailable: boolean | null;
  health: "healthy" | "unhealthy" | "unknown";
  dashboardUrl: string | null;
}

export interface ManagedAppPublic {
  id: ManagedAppId;
  name: string;
  description: string;
  installationType: InstallationType;
  status: ManagedAppStatus;
  supportedActions: ManagedAppAction[];
}

export interface ManagedAppLogResult {
  entries: string[];
  available: boolean;
}

export interface ManagedAppAdapter {
  readonly id: ManagedAppId;
  readonly name: string;
  readonly description: string;
  detect(): Promise<ManagedAppInstallation>;
  getStatus(installation: ManagedAppInstallation): Promise<ManagedAppStatus>;
  getLogs(installation: ManagedAppInstallation): Promise<ManagedAppLogResult>;
  backup(installation: ManagedAppInstallation): Promise<void>;
  start(installation: ManagedAppInstallation): Promise<void>;
  stop(installation: ManagedAppInstallation): Promise<void>;
  restart(installation: ManagedAppInstallation): Promise<void>;
  update(installation: ManagedAppInstallation): Promise<void>;
  rollback(installation: ManagedAppInstallation): Promise<void>;
  uninstall(installation: ManagedAppInstallation, preserveData: boolean): Promise<void>;
}
