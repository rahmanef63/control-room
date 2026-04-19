import type { Metadata, Viewport } from 'next';

import { TooltipProvider } from '@/components/ui/tooltip';
import { PwaUpdateBanner } from '@/shared/pwa/pwa-update-banner';
import { RegisterServiceWorker } from '@/shared/pwa/register-service-worker';
import { cn } from '@/shared/lib/utils';
import { ChunkLoadRecoveryListener } from '@/shared/runtime/chunk-load-recovery-listener';

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
};

export const viewport: Viewport = {
  themeColor: '#111821',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn('dark', 'font-sans', geist.variable)}>
      <body className="pwa-safe-shell bg-background text-foreground antialiased">
        <RegisterServiceWorker />
        <ChunkLoadRecoveryListener />
        <PwaUpdateBanner />
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
