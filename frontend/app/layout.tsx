import type { Metadata, Viewport } from 'next';

import { TooltipProvider } from '@/components/ui/tooltip';
import { RegisterServiceWorker } from '@/shared/pwa/register-service-worker';
import { VersionGuard } from '@/shared/pwa/version-guard';
import { cn } from '@/shared/lib/utils';
import { ChunkLoadRecoveryListener } from '@/shared/runtime/chunk-load-recovery-listener';
import { EARLY_ASSET_RECOVERY_SCRIPT } from '@/shared/runtime/early-asset-recovery-script';
import { PlatformProvider } from '@/shared/platform';
import { EARLY_THEME_SCRIPT } from '@/shared/platform/theme';

import './globals.css';
import { Geist } from 'next/font/google';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:4000'),
  title: {
    default: 'VPS Terminals',
    template: '%s · VPS Terminals',
  },
  description: 'Mobile-first VPS terminal workspace.',
  openGraph: {
    type: 'website',
    title: 'VPS Control Room',
    description:
      'Mobile-first PWA to drive your VPS from anywhere — multi-pane terminals + AI-agent launchers, behind one secret on a Tailscale-only domain.',
    images: [{ url: '/og-card.png', width: 2560, height: 1600, alt: 'VPS Control Room dashboard' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VPS Control Room',
    description:
      'Mobile-first PWA to drive your VPS — multi-pane terminals + AI-agent launchers, from your phone.',
    images: ['/og-card.png'],
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'VPS Terminals',
  },
  applicationName: 'VPS Terminals',
  icons: {
    icon: '/icon',
    apple: '/apple-icon',
  },
  // Generic install hint alongside the Apple-specific appleWebApp meta above.
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  themeColor: '#111821',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={cn('font-sans', geist.variable)}>
      <head>
        {/* Sets the theme class before first paint (default dark) — no flash. */}
        <script dangerouslySetInnerHTML={{ __html: EARLY_THEME_SCRIPT }} />
        {/* Production only: dev rebuilds legitimately 404 old chunk URLs during
            HMR, which would trigger this recovery purge+reload for no reason. */}
        {process.env.NODE_ENV === 'production' ? (
          <script dangerouslySetInnerHTML={{ __html: EARLY_ASSET_RECOVERY_SCRIPT }} />
        ) : null}
      </head>
      <body className="pwa-safe-shell bg-background text-foreground antialiased">
        <PlatformProvider>
          <RegisterServiceWorker />
          <ChunkLoadRecoveryListener />
          <VersionGuard />
          <TooltipProvider>{children}</TooltipProvider>
        </PlatformProvider>
      </body>
    </html>
  );
}
