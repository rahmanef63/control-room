import { NextRequest, NextResponse } from 'next/server';

import {
  buildRuntimeConfigResponse,
  writeRuntimeConfig,
} from '@/features/runtime-profiles/server/runtime-config';
import type { RuntimeConfig } from '@/shared/types/contracts';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(buildRuntimeConfigResponse(), { status: 200 });
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as RuntimeConfig;
    const config = writeRuntimeConfig(body);
    return NextResponse.json(buildRuntimeConfigResponse(config), { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save runtime config';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
