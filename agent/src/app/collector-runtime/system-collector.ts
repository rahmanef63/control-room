import { config } from '../../config.js';
import { mutate } from '../../convex-client.js';
import { collectSystem } from '../../collectors/system.js';
import { logger } from '../../logger.js';
import { updateLastSnapshot } from '../health-server.js';
import { upsertThresholdAlert } from './alerts.js';

export async function runSystemCollectorTask(): Promise<void> {
  try {
    const snapshot = await collectSystem();

    await mutate('snapshots:upsertSystemSnapshot', {
      timestamp: snapshot.timestamp,
      cpu_total: snapshot.cpu_total,
      cpu_cores: snapshot.cpu_cores,
      ram_total: snapshot.ram_total,
      ram_used: snapshot.ram_used,
      ram_available: snapshot.ram_available,
      disk: snapshot.disk,
      network: snapshot.network,
      uptime_seconds: snapshot.uptime_seconds,
      load_average: snapshot.load_average,
    });

    updateLastSnapshot(snapshot.timestamp);

    await upsertThresholdAlert({
      type: 'cpu_high',
      label: 'CPU',
      value: snapshot.cpu_total,
      warnThreshold: config.ALERT_CPU_WARNING_PERCENT,
      critThreshold: config.ALERT_CPU_CRITICAL_PERCENT,
    });

    if (snapshot.ram_total > 0) {
      const ramPercent = (snapshot.ram_used / snapshot.ram_total) * 100;
      await upsertThresholdAlert({
        type: 'ram_high',
        label: 'RAM',
        value: ramPercent,
        warnThreshold: config.ALERT_RAM_WARNING_PERCENT,
        critThreshold: config.ALERT_RAM_CRITICAL_PERCENT,
      });
    }

    for (const diskEntry of snapshot.disk) {
      if (diskEntry.total <= 0) {
        continue;
      }

      const diskPercent = (diskEntry.used / diskEntry.total) * 100;
      await upsertThresholdAlert({
        type: `disk_high_${diskEntry.mount.replace(/\//g, '_')}`,
        label: `Disk ${diskEntry.mount}`,
        value: diskPercent,
        warnThreshold: config.ALERT_DISK_WARNING_PERCENT,
        critThreshold: config.ALERT_DISK_CRITICAL_PERCENT,
      });
    }
  } catch (err) {
    logger.error('System collector error', { error: String(err) });
  }
}
