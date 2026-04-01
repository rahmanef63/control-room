'use client';

import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { type ReactNode } from 'react';

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || 'http://127.0.0.1:6791';

const convex = new ConvexReactClient(convexUrl);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
