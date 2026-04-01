import { mutate } from '../../convex-client.js';

type AlertSeverity = 'warning' | 'error' | 'critical';

interface ThresholdAlertArgs {
  type: string;
  label: string;
  value: number;
  warnThreshold: number;
  critThreshold: number;
}

export async function upsertThresholdAlert({
  type,
  label,
  value,
  warnThreshold,
  critThreshold,
}: ThresholdAlertArgs): Promise<void> {
  if (value >= critThreshold) {
    await mutate('alerts:upsertAlert', {
      type,
      message: `${label} is at ${value.toFixed(1)}% (critical threshold: ${critThreshold}%)`,
      severity: 'critical' as AlertSeverity,
      target: label,
    });
    return;
  }

  if (value >= warnThreshold) {
    await mutate('alerts:upsertAlert', {
      type,
      message: `${label} is at ${value.toFixed(1)}% (warning threshold: ${warnThreshold}%)`,
      severity: 'warning' as AlertSeverity,
      target: label,
    });
  }
}
