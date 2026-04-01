import { ExecutorRuntimeService } from './runtime-service.js';

const executorRuntime = new ExecutorRuntimeService();

export function startExecutor(): void {
  executorRuntime.start();
}

export async function stopExecutor(): Promise<void> {
  await executorRuntime.stop();
}
