import { mutate } from '../../convex-client.js';
import { collectDocker, type AppStatus } from '../../collectors/docker.js';
import { collectDokploy } from '../../collectors/dokploy.js';
import { updateKnownTargets } from '../../executor/allowlist.js';
import { logger } from '../../logger.js';

function mergeCollectedApps(
  dockerApps: AppStatus[],
  dokployApps: Partial<AppStatus>[]
): Map<string, AppStatus> {
  const appMap = new Map<string, AppStatus>();

  for (const app of dockerApps) {
    appMap.set(app.name, app);
  }

  for (const partial of dokployApps) {
    if (!partial.name) {
      continue;
    }

    const existing = appMap.get(partial.name);
    if (existing) {
      appMap.set(partial.name, {
        ...existing,
        ...partial,
        ports: partial.ports ?? existing.ports,
        source: 'dokploy',
      } as AppStatus);
      continue;
    }

    if (partial.runtime_status && partial.health_status && partial.ports) {
      appMap.set(partial.name, partial as AppStatus);
    }
  }

  return appMap;
}

async function upsertAppStatus(app: AppStatus): Promise<void> {
  const normalizedPorts = app.ports.map((port) => ({
    internal: port.internal,
    published: port.published ?? 0,
    protocol: port.protocol,
  }));

  await mutate('appStatus:upsertAppStatus', {
    name: app.name,
    source: app.source,
    runtime_status: app.runtime_status,
    health_status: app.health_status,
    ports: normalizedPorts,
    ...(app.domain !== undefined ? { domain: app.domain } : {}),
    last_seen: app.last_seen,
    ...(app.restart_count !== undefined ? { restart_count: app.restart_count } : {}),
    ...(app.last_deploy_time !== undefined
      ? { last_deploy_time: app.last_deploy_time }
      : {}),
    ...(app.last_known_error !== undefined
      ? { last_known_error: app.last_known_error }
      : {}),
    ...(app.metadata !== undefined ? { metadata: app.metadata } : {}),
  });
}

export async function runAppCollectorTask(): Promise<void> {
  try {
    const [dockerApps, dokployApps] = await Promise.all([
      collectDocker().catch((err) => {
        logger.error('Docker collector error', { error: String(err) });
        return [] as AppStatus[];
      }),
      collectDokploy().catch((err) => {
        logger.error('Dokploy collector error', { error: String(err) });
        return [] as Partial<AppStatus>[];
      }),
    ]);

    const appMap = mergeCollectedApps(dockerApps, dokployApps);

    updateKnownTargets(
      'container',
      dockerApps.map((app) => app.name)
    );
    updateKnownTargets(
      'dokploy-app',
      dokployApps.filter((app) => app.name).map((app) => app.name as string)
    );

    for (const app of appMap.values()) {
      try {
        await upsertAppStatus(app);
      } catch (err) {
        logger.error('Failed to upsert app status', {
          name: app.name,
          error: String(err),
        });
      }
    }
  } catch (err) {
    logger.error('App collector error', { error: String(err) });
  }
}
