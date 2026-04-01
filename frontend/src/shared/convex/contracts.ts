import type { CommandTargetType } from '@/shared/types/contracts';

export interface PaginatedQueryResult<T> {
  page: T[];
}

export interface EnqueueCommandInput {
  action: string;
  target_type: CommandTargetType;
  target_id: string;
  requested_by: string;
  payload?: Record<string, unknown>;
}
