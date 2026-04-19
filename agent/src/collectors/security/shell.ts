import { exec } from 'child_process';
import { promisify } from 'util';

import { logger } from '../../logger.js';

const execAsync = promisify(exec);

export async function runSecurityCommand(cmd: string): Promise<string> {
  try {
    const { stdout } = await execAsync(cmd, { timeout: 10000 });
    return stdout;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);

    if (
      err !== null &&
      typeof err === 'object' &&
      'stdout' in err &&
      typeof (err as { stdout: unknown }).stdout === 'string'
    ) {
      return (err as { stdout: string }).stdout;
    }

    logger.warn('Security command failed', { cmd: cmd.slice(0, 60), error: errMsg });
    return '';
  }
}
