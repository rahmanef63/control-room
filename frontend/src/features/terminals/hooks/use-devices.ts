'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface ApprovedDevice {
  label: string;
  approvedAt: number;
  lastSeen?: number;
}

export interface PendingDevice {
  label: string;
  firstSeen: number;
  lastSeen: number;
  ip: string;
  attempts: number;
}

export interface UseDevicesResult {
  approved: Record<string, ApprovedDevice>;
  pending: Record<string, PendingDevice>;
  pendingCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  approve: (deviceId: string, label?: string) => Promise<void>;
  revoke: (deviceId: string) => Promise<void>;
}

interface DevicesResponse {
  approved?: Record<string, ApprovedDevice>;
  pending?: Record<string, PendingDevice>;
}

/**
 * Trusted-device management for the in-app approval dialog. Polls so a new
 * device's approval request surfaces without a manual refresh. Only enabled
 * while the dialog is open to avoid background load.
 */
export function useDevices(enabled: boolean, intervalMs = 8000): UseDevicesResult {
  const [approved, setApproved] = useState<Record<string, ApprovedDevice>>({});
  const [pending, setPending] = useState<Record<string, PendingDevice>>({});
  const [loading, setLoading] = useState(false);
  const inflight = useRef(false);

  const apply = useCallback((payload: DevicesResponse) => {
    setApproved(payload.approved ?? {});
    setPending(payload.pending ?? {});
  }, []);

  const refresh = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    setLoading(true);
    try {
      const res = await fetch('/api/auth/devices', { cache: 'no-store' });
      if (res.ok) apply((await res.json()) as DevicesResponse);
    } catch {
      // transient; retry next tick
    } finally {
      setLoading(false);
      inflight.current = false;
    }
  }, [apply]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const id = setInterval(() => void refresh(), intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs, refresh]);

  const mutate = useCallback(
    async (action: 'approve' | 'revoke', deviceId: string, label?: string) => {
      try {
        const res = await fetch('/api/auth/devices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, deviceId, label }),
        });
        if (res.ok) apply((await res.json()) as DevicesResponse);
        else void refresh();
      } catch {
        void refresh();
      }
    },
    [apply, refresh]
  );

  const approve = useCallback(
    (deviceId: string, label?: string) => mutate('approve', deviceId, label),
    [mutate]
  );
  const revoke = useCallback((deviceId: string) => mutate('revoke', deviceId), [mutate]);

  return {
    approved,
    pending,
    pendingCount: Object.keys(pending).length,
    loading,
    refresh,
    approve,
    revoke,
  };
}
