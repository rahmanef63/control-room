import { collectSystem, type SystemSnapshot } from "../collectors/system.js";
import { config } from "../config.js";
import { logger } from "../logger.js";

let latestSnapshot: SystemSnapshot | null = null;
let telemetryHandle: NodeJS.Timeout | null = null;
let isCollecting = false;

function cloneSnapshot(snapshot: SystemSnapshot): SystemSnapshot {
  return {
    ...snapshot,
    cpu_cores: [...snapshot.cpu_cores],
    disk: snapshot.disk.map((disk) => ({ ...disk })),
    network: { ...snapshot.network },
    load_average: [...snapshot.load_average],
  };
}

async function sampleHostTelemetry(): Promise<void> {
  if (isCollecting) {
    return;
  }

  isCollecting = true;
  try {
    latestSnapshot = await collectSystem();
  } catch (error) {
    logger.warn("Host telemetry sample failed", {
      error: String(error),
    });
  } finally {
    isCollecting = false;
  }
}

export async function startHostTelemetry(): Promise<void> {
  await sampleHostTelemetry();

  if (telemetryHandle) {
    clearInterval(telemetryHandle);
  }

  telemetryHandle = setInterval(() => {
    void sampleHostTelemetry();
  }, config.HOST_TELEMETRY_INTERVAL_MS);
}

export function stopHostTelemetry(): void {
  if (!telemetryHandle) {
    return;
  }

  clearInterval(telemetryHandle);
  telemetryHandle = null;
}

export function getHostTelemetrySnapshot(): SystemSnapshot | null {
  return latestSnapshot ? cloneSnapshot(latestSnapshot) : null;
}
