import { NextRequest, NextResponse } from 'next/server';

import {
  approveDevice,
  isValidDeviceId,
  listDevices,
  revokeDevice,
} from '@/shared/auth/device-store';
import { requireSession } from '@/shared/auth/require-session';

export const runtime = 'nodejs';

// In-app device management. Only an already-authenticated (i.e. already-trusted)
// session may list pending devices and approve/revoke them — so the owner can
// approve a new device from a device that's already logged in, without the CLI.

export async function GET() {
  const denied = await requireSession();
  if (denied) return denied;
  const { approved, pending } = await listDevices();
  return NextResponse.json({ approved, pending });
}

export async function POST(request: NextRequest) {
  const denied = await requireSession();
  if (denied) return denied;

  let body: { action?: string; deviceId?: string; label?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { action, deviceId, label } = body;
  if (!isValidDeviceId(deviceId)) {
    return NextResponse.json({ error: 'Missing or invalid device id' }, { status: 400 });
  }

  if (action === 'approve') {
    await approveDevice(deviceId, typeof label === 'string' ? label : undefined);
  } else if (action === 'revoke') {
    await revokeDevice(deviceId);
  } else {
    return NextResponse.json({ error: 'action must be approve or revoke' }, { status: 400 });
  }

  const { approved, pending } = await listDevices();
  return NextResponse.json({ ok: true, approved, pending });
}
